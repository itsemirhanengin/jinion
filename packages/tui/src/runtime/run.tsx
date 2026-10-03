import type { ReactNode } from 'react';
import { render, type Instance, type RenderOptions } from 'ink';
import { themes, type ColorScheme, type Theme } from '../theme/themes.js';
import { Root } from './context.js';
import { detectColorScheme } from './detect-scheme.js';
import { createInput, DISABLE_FOCUS, DISABLE_MOUSE, ENABLE_FOCUS, ENABLE_MOUSE, type MouseListener } from './input.js';
import { createTerminalControl } from './terminal.js';

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
export async function run(node: ReactNode, options: RunOptions = {}): Promise<Instance> {
  const theme = options.theme ?? themes[options.scheme ?? (await detectColorScheme())];
  const { stdout } = process;
  const interactive = Boolean(stdout.isTTY && process.stdin.isTTY);
  const mouse = new Set<MouseListener>();
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
      {node}
    </Root>,
    {
      stdin: input?.stdin,
      alternateScreen: true,
      exitOnCtrlC: false,
      incrementalRendering: true,
      maxFps: 60,
      // 'auto' queries the terminal, and Ink 7.1 also delivers the reply as typed
      // input ("[?0u" in the prompt). Terminals without the protocol ignore the
      // enable sequence, so turning it on unconditionally is safe.
      kittyKeyboard: { mode: 'enabled', flags: ['disambiguateEscapeCodes'] },
      ...options.ink,
    },
  );

  if (interactive) {
    const restore = () => stdout.write(DISABLE_MOUSE + DISABLE_FOCUS);
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
