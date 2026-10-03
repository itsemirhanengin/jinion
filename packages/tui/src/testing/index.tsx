import { PassThrough, Writable } from 'node:stream';
import type { ReactNode } from 'react';
import { render } from 'ink';
import xterm from '@xterm/headless';
import { Root } from '../runtime/context.js';
import { DRAWING } from '../runtime/drawing.js';
import { createInput, type MouseListener } from '../runtime/input.js';
import { tapStream } from '../runtime/screen.js';
import { SelectionLayer } from '../runtime/selection.js';
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
  pageUp: '\x1b[5~',
  pageDown: '\x1b[6~',
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
  /**
   * Clicks the first place that shows `text`, on its cell `at` characters in: the left button down and up, reported as
   * a terminal with mouse reporting on does.
   */
  click(text: string, at?: number): Promise<void>;
  /**
   * Drags with the left button from the first place that shows `from` to the first that shows `to`, on their cells
   * `fromAt` and `toAt` characters in, and lets go there.
   */
  drag(from: string, to: string, fromAt?: number, toAt?: number): Promise<void>;
  /** Clicks the first place that shows `text` `times` times in a row, as a double or triple click. */
  multiClick(text: string, times: number, at?: number): Promise<void>;
  /** What the app put on the clipboard so far, through OSC 52, oldest first. */
  clipboard(): string[];
  /** Moves the pointer onto the first place that shows `text`, with no button held. */
  hover(text: string, at?: number): Promise<void>;
  /** The background color of the first place that shows `text`, as `#rrggbb`, or `undefined` for the default. */
  backgroundOf(text: string, at?: number): Promise<string | undefined>;
  /** The mouse pointer's shape the app asked for last, `default` until it asks. */
  pointer(): string;
  /** Reports the window gaining or losing focus, as a terminal does. */
  focus(focused: boolean): Promise<void>;
  /** The desktop notifications shown so far, as `title: body`. */
  notifications(): string[];
  /**
   * Writes straight to the screen behind Ink's back, e.g. `\x1b[5;1Hstray`, as a terminal effectively does when it
   * lays a character out wider or narrower than Ink measured it.
   */
  scribble(data: string): Promise<void>;
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
  // What is drawn goes through a screen, as in `run()`; the clipboard is the terminal's, through OSC 52.
  const shown = tapStream(stdout);
  const terminalControl = createTerminalControl((data) => stdout.write(data), 'osc777', 'osc52');
  const notifications: string[] = [];
  const clipboard: string[] = [];
  terminal.parser.registerOscHandler(52, (data) => {
    clipboard.push(Buffer.from(data.slice(data.indexOf(';') + 1), 'base64').toString());
    return true;
  });
  let pointer = 'default';
  terminal.parser.registerOscHandler(22, (data) => {
    pointer = data;
    return true;
  });
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
      <SelectionLayer screen={shown}>{node}</SelectionLayer>
    </Root>,
    { stdout, stdin: input.stdin, interactive: true, patchConsole: false, ...DRAWING },
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

  /** Where `text` first shows, as an SGR mouse report has it: column and row, counted from 1. */
  const cellOf = async (text: string, at: number) => {
    await drawn();
    const shown = lines();
    const y = shown.findIndex((line) => line.includes(text));
    if (y === -1) throw new Error(`The screen doesn't show ${text} to point at. It shows:\n${shown.join('\n')}`);
    return `${shown[y]!.indexOf(text) + at + 1};${y + 1}`;
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
    click: async (text, at = 0) => {
      const cell = await cellOf(text, at);
      await send(`\x1b[<0;${cell}M\x1b[<0;${cell}m`);
    },
    drag: async (from, to, fromAt = 0, toAt = 0) => {
      const start = await cellOf(from, fromAt);
      const end = await cellOf(to, toAt);
      await send(`\x1b[<0;${start}M`);
      await send(`\x1b[<32;${end}M`);
      await send(`\x1b[<0;${end}m`);
    },
    multiClick: async (text, times, at = 0) => {
      const cell = await cellOf(text, at);
      for (let click = 0; click < times; click++) await send(`\x1b[<0;${cell}M\x1b[<0;${cell}m`);
    },
    clipboard: () => [...clipboard],
    hover: async (text, at = 0) => send(`\x1b[<35;${await cellOf(text, at)}M`),
    backgroundOf: async (text, at = 0) => {
      await drawn();
      const buffer = terminal.buffer.active;
      for (let y = 0; y < rows; y++) {
        const line = buffer.getLine(buffer.viewportY + y);
        const x = line?.translateToString(true).indexOf(text) ?? -1;
        const cell = x >= 0 ? line?.getCell(x + at) : undefined;
        if (!cell) continue;
        if (cell.isBgDefault()) return undefined;
        return `#${cell.getBgColor().toString(16).padStart(6, '0')}`;
      }
      return undefined;
    },
    pointer: () => pointer,
    focus: (focused) => send(focused ? '\x1b[I' : '\x1b[O'),
    notifications: () => [...notifications],
    scribble: (data) => new Promise<void>((resolve) => terminal.write(data, resolve)),
    unmount: () => {
      instance.unmount();
      input.close();
      terminal.dispose();
    },
  };
}
