import type { TerminalInfo, TerminalOutput } from '@jinion/core/api/protocol';
import { classNames, FadeText } from '@jinion/ui';
import { IconButton } from '@jinion/workbench';
import { FitAddon } from '@xterm/addon-fit';
import { WebglAddon } from '@xterm/addon-webgl';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import './terminal.css';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useCore } from '../../state/session.js';
import { folderOf, TerminalMark, TerminalStatus } from './marks.js';
import { TERMINAL_FONT, terminalTheme } from './theme.js';

export interface TerminalPaneProps {
  terminal: TerminalInfo;
  focused: boolean;
  /** One of several side by side, so it can be closed from its own title. */
  split: boolean;
  onFocus: () => void;
  onClose: () => void;
}

/** One terminal: a thin title over its screen; the focused one in ink and with the keys. */
export function TerminalPane({ terminal, focused, split, onFocus, onClose }: TerminalPaneProps) {
  const core = useCore();

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a click anywhere on a pane gives it the keys, as xterm's own textarea takes them
    <div data-terminal-pane className="flex min-w-0 flex-1 flex-col" onMouseDown={onFocus}>
      <div className={classNames('group flex h-8 shrink-0 items-center gap-2 pr-1 pl-3', focused ? 'text-ink' : 'text-muted')}>
        <TerminalMark terminal={terminal} />
        <span className="shrink-0">{terminal.title}</span>
        <FadeText className="text-faint">{folderOf(terminal.cwd, core.project.path)}</FadeText>
        <TerminalStatus terminal={terminal} />
        {split && (
          <span className="opacity-0 group-hover:opacity-100 focus-within:opacity-100">
            <IconButton label="Close the terminal" onClick={onClose}>
              <X />
            </IconButton>
          </span>
        )}
      </div>
      <Screen id={terminal.id} focused={focused} />
    </div>
  );
}

/**
 * The terminal drawn by xterm: the screen as the core keeps it, then its output as it comes, without what the screen
 * already held; what is typed and the size go back to the core.
 */
function Screen({ id, focused }: { id: string; focused: boolean }) {
  const core = useCore();
  const host = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal>(null);

  useEffect(() => {
    const element = host.current;
    if (!element) return;

    const xterm = new Terminal({
      fontFamily: TERMINAL_FONT,
      fontSize: 12,
      lineHeight: 1.25,
      cursorBlink: true,
      scrollback: 5000,
      // Prompts made for dark terminals write dark text on their own colored segments; xterm lightens or darkens such
      // text until it reads, as VS Code does by default.
      minimumContrastRatio: 4.5,
      theme: terminalTheme(),
    });

    const fit = new FitAddon();
    let shown: number | undefined;
    const early: TerminalOutput[] = [];
    let gone = false;

    const write = (output: TerminalOutput) => {
      if (shown !== undefined && output.seq <= shown) return;

      xterm.write(output.data);
      shown = output.seq;
    };

    const stopOutput = core.client.on('terminals/output', (output) => {
      if (output.id !== id) return;

      if (shown === undefined) early.push(output);
      else write(output);
    });

    const input = xterm.onData((data) => core.act(core.typeInTerminal(id, data)));
    const resized = xterm.onResize(({ cols, rows }) => core.act(core.resizeTerminal(id, cols, rows)));

    // A panel with no room yet has nothing to fit to.
    const fitNow = () => {
      if (element.clientWidth > 0 && element.clientHeight > 0) fit.fit();
    };

    const sized = new ResizeObserver(fitNow);
    const themed = new MutationObserver(() => (xterm.options.theme = terminalTheme()));

    // Measured in its own font, so the font must be there before the terminal opens. A terminal closed meanwhile has
    // nothing to attach to, and its pane goes with the next list.
    void document.fonts
      .load(`12px ${TERMINAL_FONT}`)
      .then(async () => {
      if (gone) return;

      xterm.loadAddon(fit);
      xterm.open(element);
      drawWithWebgl(xterm);
      terminal.current = xterm;
      fitNow();
      sized.observe(element);
      themed.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

      const { screen, seq } = await core.attachTerminal(id);
      if (gone) return;

      xterm.write(screen);
      shown = seq;
      for (const output of early.splice(0)) write(output);
      if (focused) xterm.focus();
      })
      .catch(() => {});

    return () => {
      gone = true;
      stopOutput();
      input.dispose();
      resized.dispose();
      sized.disconnect();
      themed.disconnect();
      terminal.current = null;
      xterm.dispose();
      core.act(core.detachTerminal(id));
    };
  }, [core, id]);

  useEffect(() => {
    if (focused) terminal.current?.focus();
  }, [focused]);

  return (
    <div className="min-h-0 flex-1 px-3 pb-1">
      <div ref={host} className="h-full w-full" />
    </div>
  );
}

/**
 * Drawn on the GPU, which also draws a prompt's powerline arrows and branch mark itself, edge to edge, rather than
 * leaving them to a font; xterm goes back to its DOM renderer when the GPU context is lost.
 */
function drawWithWebgl(xterm: Terminal) {
  try {
    const webgl = new WebglAddon();

    webgl.onContextLoss(() => webgl.dispose());
    xterm.loadAddon(webgl);
  } catch {
    // Without WebGL the DOM renderer stays, with the font's own glyphs.
  }
}
