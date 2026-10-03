import { PassThrough } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';

export type MouseEvent =
  | { type: 'wheel'; direction: 'up' | 'down'; x: number; y: number }
  | { type: 'press' | 'release'; button: number; x: number; y: number };

export type MouseListener = (event: MouseEvent) => void;
export type FocusListener = (focused: boolean) => void;

/** Button presses and the wheel, reported with SGR coordinates. */
export const ENABLE_MOUSE = '\x1b[?1000h\x1b[?1006h';
export const DISABLE_MOUSE = '\x1b[?1000l\x1b[?1006l';

/** The terminal sends `\x1b[I` when its window gains focus and `\x1b[O` when it loses it. */
export const ENABLE_FOCUS = '\x1b[?1004h';
export const DISABLE_FOCUS = '\x1b[?1004l';

const MOUSE_SEQUENCE = /\x1b\[<(\d+);(\d+);(\d+)([Mm])/g;
const FOCUS_SEQUENCE = /\x1b\[([IO])/g;
const PARTIAL_MOUSE_SEQUENCE = /\x1b\[<[\d;]*$/;
const WHEEL = 64;
const MOTION = 32;

function parseMouse(code: number, column: number, row: number, final: string): MouseEvent | undefined {
  if (code & MOTION) return undefined;
  const position = { x: column - 1, y: row - 1 };
  if (code & WHEEL) return { type: 'wheel', direction: (code & 1) === 0 ? 'up' : 'down', ...position };
  return { type: final === 'M' ? 'press' : 'release', button: code & 3, ...position };
}

/**
 * Wraps the terminal's stdin so mouse and focus reports never reach Ink's key parser.
 * Ink reads the returned stream; mouse events go to `onMouse` and focus changes to `onFocus` instead.
 */
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
  // Background detection pauses stdin, and a new 'data' listener does not
  // restart an explicitly paused stream; without this nothing keeps the
  // process alive and it exits right after mounting.
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
