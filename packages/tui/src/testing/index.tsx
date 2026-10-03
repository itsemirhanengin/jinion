import { PassThrough, Writable } from 'node:stream';
import type { ReactNode } from 'react';
import xterm from '@xterm/headless';
import { mount } from '../runtime/mount.js';
import { createTerminalControl } from '../runtime/terminal.js';
import { darkTheme, type Theme } from '../theme/themes.js';

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
  screen(): Promise<string>;
  type(text: string): Promise<void>;
  press(...keys: string[]): Promise<void>;
  waitFor(text: string | RegExp, timeout?: number): Promise<string>;
  colorOf(text: string, at?: number): Promise<string | undefined>;
  click(text: string, at?: number): Promise<void>;
  drag(from: string, to: string, fromAt?: number, toAt?: number): Promise<void>;
  multiClick(text: string, times: number, at?: number): Promise<void>;
  clipboard(): string[];
  hover(text: string, at?: number): Promise<void>;
  backgroundOf(text: string, at?: number): Promise<string | undefined>;
  pointer(): string;
  focus(focused: boolean): Promise<void>;
  notifications(): string[];
  /** Writes behind Ink's back, as a terminal effectively does when it lays a character out wider or narrower than Ink. */
  scribble(data: string): Promise<void>;
  unmount(): void;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

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
  const { instance, close } = mount(node, {
    theme,
    terminal: terminalControl,
    keyboard,
    display: stdout,
    ink: { stdout, interactive: true, patchConsole: false },
  });

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

  // As an SGR mouse report has it: column and row, from 1.
  const cellOf = async (text: string, at: number) => {
    await drawn();
    const shown = lines();
    const y = shown.findIndex((line) => line.includes(text));
    if (y === -1) throw new Error(`The screen doesn't show ${text} to point at. It shows:\n${shown.join('\n')}`);
    return `${shown[y]!.indexOf(text) + at + 1};${y + 1}`;
  };

  const cellShowing = async (text: string, at: number) => {
    await drawn();
    const buffer = terminal.buffer.active;
    for (let y = 0; y < rows; y++) {
      const line = buffer.getLine(buffer.viewportY + y);
      const x = line?.translateToString(true).indexOf(text) ?? -1;
      const cell = x >= 0 ? line?.getCell(x + at) : undefined;
      if (cell) return cell;
    }
    return undefined;
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
      const cell = await cellShowing(text, at);
      return cell && !cell.isFgDefault() ? hex(cell.getFgColor()) : undefined;
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
      const cell = await cellShowing(text, at);
      return cell && !cell.isBgDefault() ? hex(cell.getBgColor()) : undefined;
    },
    pointer: () => pointer,
    focus: (focused) => send(focused ? '\x1b[I' : '\x1b[O'),
    notifications: () => [...notifications],
    scribble: (data) => new Promise<void>((resolve) => terminal.write(data, resolve)),
    unmount: () => {
      instance.unmount();
      close();
      terminal.dispose();
    },
  };
}
