import { PassThrough } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';

export type MouseEvent =
  | { type: 'wheel'; direction: 'up' | 'down'; x: number; y: number }
  | { type: 'press' | 'release'; button: number; x: number; y: number }
  | { type: 'move'; button: number | undefined; x: number; y: number };

export type MouseListener = (event: MouseEvent) => void;
export type FocusListener = (focused: boolean) => void;

/** 1000 presses and the wheel, 1003 every move (for hovering), 1006 SGR coordinates. */
export const ENABLE_MOUSE = '\x1b[?1000h\x1b[?1003h\x1b[?1006h';
export const DISABLE_MOUSE = '\x1b[?1003l\x1b[?1000l\x1b[?1006l';

/** The terminal sends `\x1b[I` on gaining focus and `\x1b[O` on losing it. */
export const ENABLE_FOCUS = '\x1b[?1004h';
export const DISABLE_FOCUS = '\x1b[?1004l';

const MOUSE_SEQUENCE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;
const FOCUS_SEQUENCE = /\x1b\[([IO])/g;
const PARTIAL_MOUSE_SEQUENCE = /\x1b\[<[\d;]*$/;
const WHEEL = 64;
const MOTION = 32;

// A move reports this as its button when none is held.
const NO_BUTTON = 3;

/** Keeps mouse and focus reports out of Ink's key parser. */
export function createInput(source: NodeJS.ReadStream, onMouse: MouseListener, onFocus?: FocusListener) {
  const stream = new PassThrough();
  const decoder = new StringDecoder('utf8');
  let pending = '';

  const onData = (chunk: Buffer | string) => {
    let text = pending + (typeof chunk === 'string' ? chunk : decoder.write(chunk));

    pending = PARTIAL_MOUSE_SEQUENCE.exec(text)?.[0] ?? '';
    if (pending) text = text.slice(0, -pending.length);

    text = text.replace(MOUSE_SEQUENCE, (_, code: string, column: string, row: string, final: string) => {
      const event = parseMouse(Number(code), Number(column), Number(row), final);

      if (event) onMouse(event);

      return '';
    });

    text = text.replace(FOCUS_SEQUENCE, (_, which: string) => {
      onFocus?.(which === 'I');

      return '';
    });

    if (text) stream.write(text);
  };

  source.on('data', onData);
  // Background detection pauses stdin and a new 'data' listener won't resume it; without this the process exits.
  source.resume();

  const stdin = Object.assign(stream, {
    isTTY: source.isTTY,
    setRawMode(mode: boolean) {
      source.setRawMode?.(mode);

      return stdin;
    },
    ref() {
      source.ref();

      return stdin;
    },
    unref() {
      source.unref();

      return stdin;
    },
  }) as unknown as NodeJS.ReadStream;

  const close = () => {
    source.off('data', onData);
    source.pause();
  };

  return { stdin, close };
}

function parseMouse(code: number, column: number, row: number, final: string): MouseEvent | undefined {
  const position = { x: column - 1, y: row - 1 };

  if (code & MOTION) {
    if (code & WHEEL) return undefined;

    return { type: 'move', button: (code & 3) === NO_BUTTON ? undefined : code & 3, ...position };
  }

  if (code & WHEEL) return { type: 'wheel', direction: (code & 1) === 0 ? 'up' : 'down', ...position };

  return { type: final === 'M' ? 'press' : 'release', button: code & 3, ...position };
}
