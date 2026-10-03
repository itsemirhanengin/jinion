import { PassThrough, Writable } from 'node:stream';
import type { ReactNode } from 'react';
import { render } from 'ink';
import xterm from '@xterm/headless';
import { Root } from '../runtime/context.js';
import { createInput, type MouseListener } from '../runtime/input.js';
import { createTerminalControl } from '../runtime/terminal.js';
import { darkTheme, type Theme } from '../theme/themes.js';

/** What a terminal sends for keys that aren't text. */
export const KEYS = {
  enter: '\r',
  escape: '\x1b',
  tab: '\t',
  shiftTab: '\x1b[Z',
  backspace: '\x7f',
  up: '\x1b[A',
  down: '\x1b[B',
  right: '\x1b[C',
  left: '\x1b[D',
  ctrlC: '\x03',
} as const;

export interface TerminalOptions {
  columns?: number;
  rows?: number;
  theme?: Theme;
}

export interface TestTerminal {
  /** The visible screen, one line per row without trailing spaces, once everything written so far is drawn. */
  screen(): Promise<string>;
  /** Types `text` a character at a time, as a person would, so each key is handled on its own. */
  type(text: string): Promise<void>;
  /** Presses keys from `KEYS`, one after another. */
  press(...keys: string[]): Promise<void>;
  /** Resolves with the screen once it shows `text`; fails with the screen after `timeout` ms. */
  waitFor(text: string | RegExp, timeout?: number): Promise<string>;
  /**
   * The foreground color of the first place that shows `text`, as `#rrggbb`, or `undefined` for the default; of the
   * cell `at` characters into it when given.
   */
  colorOf(text: string, at?: number): Promise<string | undefined>;
  /** Reports the window gaining or losing focus, as a terminal does. */
  focus(focused: boolean): Promise<void>;
  /** The desktop notifications shown so far, as `title: body`. */
  notifications(): string[];
  unmount(): void;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mounts `node` the way `run()` does, in an emulated terminal instead of the real one, for tests that press keys and
 * read the screen. Input goes through the same mouse filter as in the app.
 */
export function renderTerminal(node: ReactNode, { columns = 120, rows = 40, theme = darkTheme }: TerminalOptions = {}): TestTerminal {
  // A TTY turns `\n` into a new line at column 0, and Ink counts on it.
  const terminal = new xterm.Terminal({ cols: columns, rows, allowProposedApi: true, convertEol: true });
  const stdout = Object.assign(
    new Writable({
      write(chunk, _, done) {
        terminal.write(typeof chunk === 'string' ? chunk : new Uint8Array(chunk), () => done());
      },
    }),
    { isTTY: true, columns, rows },
  ) as unknown as NodeJS.WriteStream;
  const keyboard = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode: () => keyboard,
    ref: () => keyboard,
    unref: () => keyboard,
  }) as unknown as NodeJS.ReadStream;
  const mouse = new Set<MouseListener>();
  // Notifications go out as OSC 777, as in Ghostty, and the emulator keeps them.
  const terminalControl = createTerminalControl((data) => stdout.write(data), 'osc777');
  const notifications: string[] = [];
  terminal.parser.registerOscHandler(777, (data) => {
    const [, title, ...body] = data.split(';');
    notifications.push(`${title}: ${body.join(';')}`);
    return true;
  });
  const input = createInput(
    keyboard,
    (event) => {
      for (const listener of mouse) listener(event);
    },
    terminalControl.setFocused,
  );

  const instance = render(
    <Root theme={theme} mouse={mouse} terminal={terminalControl.control}>
      {node}
    </Root>,
    { stdout, stdin: input.stdin, interactive: true, alternateScreen: true, exitOnCtrlC: false, patchConsole: false },
  );

  const drawn = () => new Promise<void>((resolve) => terminal.write('', resolve));
  const lines = () => {
    const buffer = terminal.buffer.active;
    // The cursor is drawn as a cell of its own, which `translateToString` keeps.
    return Array.from({ length: rows }, (_, y) => buffer.getLine(buffer.viewportY + y)?.translateToString(true).trimEnd() ?? '');
  };
  const screen = async () => {
    await drawn();
    return lines().join('\n');
  };
  // Long enough for Ink to handle the key and draw what follows. A lone escape needs longer: until Ink gives up waiting
  // for the rest of an escape sequence, a key right after it would read as alt+key.
  const send = async (data: string) => {
    keyboard.write(data);
    await pause(data === KEYS.escape ? 150 : 20);
  };

  return {
    screen,
    type: async (text) => {
      for (const char of text) await send(char);
    },
    press: async (...keys) => {
      for (const key of keys) await send(key);
    },
    waitFor: async (text, timeout = 5_000) => {
      const end = Date.now() + timeout;
      let shown = '';
      while (Date.now() < end) {
        shown = await screen();
        if (typeof text === 'string' ? shown.includes(text) : text.test(shown)) return shown;
        await pause(25);
      }
      throw new Error(`The screen never showed ${String(text)}. It shows:\n${shown}`);
    },
    colorOf: async (text, at = 0) => {
      await drawn();
      const buffer = terminal.buffer.active;
      for (let y = 0; y < rows; y++) {
        const line = buffer.getLine(buffer.viewportY + y);
        const x = line?.translateToString(true).indexOf(text) ?? -1;
        const cell = x >= 0 ? line?.getCell(x + at) : undefined;
        if (!cell) continue;
        if (cell.isFgDefault()) return undefined;
        return `#${cell.getFgColor().toString(16).padStart(6, '0')}`;
      }
      return undefined;
    },
    focus: (focused) => send(focused ? '\x1b[I' : '\x1b[O'),
    notifications: () => [...notifications],
    unmount: () => {
      instance.unmount();
      input.close();
      terminal.dispose();
    },
  };
}
