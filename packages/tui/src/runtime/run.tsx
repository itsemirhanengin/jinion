import type { ReactNode } from 'react';
import type { Instance, RenderOptions } from 'ink';
import { themes, type ColorScheme, type Theme } from '../theme/themes.js';
import { detectBackground } from './detect-scheme.js';
import { DISABLE_FOCUS, DISABLE_MOUSE, ENABLE_FOCUS, ENABLE_MOUSE } from './input.js';
import { mount } from './mount.js';
import { createTerminalControl, pointerSequence } from './terminal.js';

export interface RunOptions {
  /** Skips terminal background detection. */
  scheme?: ColorScheme;
  theme?: Theme;
  ink?: RenderOptions;
}

export async function run(node: ReactNode, options: RunOptions = {}): Promise<Instance> {
  const theme = options.theme ?? (await themeFor(options.scheme));
  const { stdout } = process;
  const interactive = Boolean(stdout.isTTY && process.stdin.isTTY);

  const { instance, close } = mount(node, {
    theme,
    terminal: createTerminalControl((data) => interactive && stdout.write(data)),
    keyboard: interactive ? process.stdin : undefined,
    display: interactive ? stdout : undefined,
    ink: {
      maxFps: 60,
      // 'auto' queries the terminal, and Ink 7.1 delivers the reply as typed input ("[?0u" in the prompt). Terminals
      // without the protocol ignore the enable sequence, so turning it on unconditionally is safe.
      kittyKeyboard: { mode: 'enabled', flags: ['disambiguateEscapeCodes'] },
      ...options.ink,
    },
  });

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
        close();
      });
  }

  return instance;
}

async function themeFor(scheme: ColorScheme | undefined): Promise<Theme> {
  const background = await detectBackground();
  const chosen = scheme ?? background.scheme;

  return { ...themes[chosen], background: background.scheme === chosen ? background.color : undefined };
}
