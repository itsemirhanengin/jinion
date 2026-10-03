import type { ReactNode } from 'react';
import { render, type Instance, type RenderOptions } from 'ink';
import { themes, type ColorScheme, type Theme } from '../theme/themes.js';
import { Root } from './context.js';
import { detectBackground } from './detect-scheme.js';
import { createInput, DISABLE_FOCUS, DISABLE_MOUSE, ENABLE_FOCUS, ENABLE_MOUSE, type MouseListener } from './input.js';
import { DRAWING } from './drawing.js';
import { tapStream } from './screen.js';
import { SelectionLayer } from './selection.js';
import { createTerminalControl, pointerSequence } from './terminal.js';

export interface RunOptions {
  /** Skips terminal background detection. */
  scheme?: ColorScheme;
  theme?: Theme;
  ink?: RenderOptions;
}

/**
 * Mounts an app full screen in the alternate screen buffer, with mouse
 * reporting on so scroll views receive the wheel, and focus reporting on so
 * the app knows when to notify.
 */
/**
 * The theme for the terminal's background, or for `scheme` when one is asked for. The background's own color, when the
 * terminal tells it and it is of that scheme, is what hovering is worked out from.
 */
async function themeFor(scheme: ColorScheme | undefined): Promise<Theme> {
  const background = await detectBackground();
  const chosen = scheme ?? background.scheme;
  return { ...themes[chosen], background: background.scheme === chosen ? background.color : undefined };
}

export async function run(node: ReactNode, options: RunOptions = {}): Promise<Instance> {
  const theme = options.theme ?? (await themeFor(options.scheme));
  const { stdout } = process;
  const interactive = Boolean(stdout.isTTY && process.stdin.isTTY);
  const mouse = new Set<MouseListener>();
  // What is drawn goes through a screen that reads it, for selecting text with the mouse.
  const screen = interactive ? tapStream(stdout) : undefined;
  const terminal = createTerminalControl((data) => interactive && stdout.write(data));
  const input = interactive
    ? createInput(
        process.stdin,
        (event) => {
          for (const listener of mouse) listener(event);
        },
        terminal.setFocused,
      )
    : undefined;

  const instance = render(
    <Root theme={theme} mouse={mouse} terminal={terminal.control}>
      <SelectionLayer screen={screen}>{node}</SelectionLayer>
    </Root>,
    {
      stdin: input?.stdin,
      ...DRAWING,
      maxFps: 60,
      // 'auto' queries the terminal, and Ink 7.1 also delivers the reply as typed
      // input ("[?0u" in the prompt). Terminals without the protocol ignore the
      // enable sequence, so turning it on unconditionally is safe.
      kittyKeyboard: { mode: 'enabled', flags: ['disambiguateEscapeCodes'] },
      ...options.ink,
    },
  );

  if (interactive) {
    const restore = () => stdout.write(DISABLE_MOUSE + DISABLE_FOCUS + pointerSequence('default'));
    stdout.write(ENABLE_MOUSE + ENABLE_FOCUS);
    process.once('exit', restore);
    instance
      .waitUntilExit()
      .catch(() => {})
      .finally(() => {
        process.off('exit', restore);
        restore();
        input?.close();
      });
  }

  return instance;
}
