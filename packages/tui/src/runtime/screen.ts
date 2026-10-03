import { frameCells, paintRange, rangeText, type Range } from './cells.js';

// Synchronized output: Ink draws each frame between these.
const BEGIN_FRAME = '\x1b[?2026h';
const END_FRAME = '\x1b[?2026l';

export interface Selection {
  range: Range;
  background: string;
  text?: string;
}

// Cursor moves and erases in a frame; a repaint puts each row in place itself.
const PLACING = /\x1b\[[0-?]*[ -/]*[@-ln-~]/g;

/**
 * Each Ink frame is a whole screen between the synchronized output markers. A selection whose text the next frame no
 * longer shows there, as when the conversation moves under it, is dropped.
 */
export class Screen {
  private frame = '';
  private pending: string | undefined;
  private selection: Selection | undefined;
  private readonly dropped = new Set<() => void>();

  constructor(private readonly out: (data: string) => void) {}

  write(data: string) {
    let rest = data;
    while (rest) {
      if (this.pending === undefined) {
        const begin = rest.indexOf(BEGIN_FRAME);
        if (begin === -1) {
          this.out(rest);
          return;
        }
        if (begin > 0) this.out(rest.slice(0, begin));
        this.pending = '';
        rest = rest.slice(begin + BEGIN_FRAME.length);
        continue;
      }
      const end = rest.indexOf(END_FRAME);
      if (end === -1) {
        this.pending += rest;
        return;
      }
      this.frameDone(this.pending + rest.slice(0, end));
      this.pending = undefined;
      rest = rest.slice(end + END_FRAME.length);
    }
  }

  cells() {
    return frameCells(this.frame);
  }

  select(selection: Selection | undefined) {
    this.selection = selection;
    this.repaint();
  }

  onDrop(listener: () => void) {
    this.dropped.add(listener);
    return () => void this.dropped.delete(listener);
  }

  private frameDone(frame: string) {
    // Moving only the cursor is not a frame: there is nothing in it to read.
    const drawn = frame.includes('\n') || frameCells(frame).some((row) => row.length > 0);
    if (drawn) this.frame = frame;
    const selection = this.selection;
    if (drawn && selection?.text !== undefined && rangeText(this.cells(), selection.range) !== selection.text) {
      this.selection = undefined;
      for (const listener of this.dropped) listener();
    }
    const painted = drawn && this.selection ? paintRange(frame, this.selection.range, this.selection.background) : frame;
    this.out(BEGIN_FRAME + painted + END_FRAME);
  }

  private repaint() {
    if (!this.frame) return;
    const rows = this.frame.replace(PLACING, '').split('\n');
    const plain = rows.join('\n');
    const painted = (this.selection ? paintRange(plain, this.selection.range, this.selection.background) : plain).split('\n');
    const placed = painted.map((row, y) => `\x1b[0m\x1b[${y + 1};1H\x1b[2K${row}`).join('');
    this.out(`${BEGIN_FRAME}\x1b7${placed}\x1b[0m\x1b8${END_FRAME}`);
  }
}

export function tapStream(stream: NodeJS.WriteStream) {
  const write = stream.write.bind(stream) as (data: string | Uint8Array, ...rest: unknown[]) => boolean;
  const screen = new Screen((data) => void write(data));
  stream.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    if (typeof chunk !== 'string') return write(chunk, ...rest);
    screen.write(chunk);
    const done = rest.find((arg) => typeof arg === 'function') as (() => void) | undefined;
    if (done) queueMicrotask(done);
    return true;
  }) as typeof stream.write;
  return screen;
}
