import stringWidth from 'string-width';

/** Synchronized output: Ink draws each frame between these, so the terminal shows it at once. */
const BEGIN_FRAME = '\x1b[?2026h';
const END_FRAME = '\x1b[?2026l';

export interface Point {
  x: number;
  y: number;
}

/** Cells from `from` to `to`, both included, in reading order: the rest of the first row, whole rows, the start of the last. */
export interface Range {
  from: Point;
  to: Point;
}

/** A cell of a row: where it starts, how many columns it takes, and what it shows. */
export interface Cell {
  x: number;
  width: number;
  text: string;
}

type Token = { escape: string } | { text: string };

const ESCAPE = /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[PX^_][^\x1b]*\x1b\\|[@-Z\\-_]|[0-9=>])/y;
const segmenter = new Intl.Segmenter();

/** Escape sequences, which take no room, and the characters between them, a grapheme at a time. */
function tokenize(data: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  while (at < data.length) {
    ESCAPE.lastIndex = at;
    const sequence = data[at] === '\x1b' ? ESCAPE.exec(data) : null;
    if (sequence) {
      tokens.push({ escape: sequence[0] });
      at += sequence[0].length;
      continue;
    }
    const next = data.indexOf('\x1b', at + 1);
    const text = data.slice(at, next === -1 ? undefined : next);
    for (const { segment } of segmenter.segment(text)) tokens.push({ text: segment });
    at += text.length;
  }
  return tokens;
}

/** The rows of a frame as cells, with every escape sequence left out. */
export function frameCells(frame: string): Cell[][] {
  const rows: Cell[][] = [[]];
  let x = 0;
  for (const token of tokenize(frame)) {
    if ('escape' in token) continue;
    if (token.text === '\n') {
      rows.push([]);
      x = 0;
      continue;
    }
    const width = stringWidth(token.text);
    if (width === 0) continue;
    rows.at(-1)!.push({ x, width, text: token.text });
    x += width;
  }
  return rows;
}

/** In reading order, whichever end the drag started from. */
export function orderRange(a: Point, b: Point): Range {
  return a.y < b.y || (a.y === b.y && a.x <= b.x) ? { from: a, to: b } : { from: b, to: a };
}

/** Whether a cell of `width` columns at `x` on row `y` is in `range`. */
function covers(range: Range, y: number, x: number, width: number) {
  if (y < range.from.y || y > range.to.y) return false;
  const start = y === range.from.y ? range.from.x : 0;
  const end = y === range.to.y ? range.to.x : Number.POSITIVE_INFINITY;
  return x + width - 1 >= start && x <= end;
}

/** The text in `range`, a line per row, without the spaces rows end with. */
export function rangeText(rows: Cell[][], range: Range) {
  const lines: string[] = [];
  for (let y = range.from.y; y <= range.to.y; y++) {
    const cells = rows[y] ?? [];
    lines.push(
      cells
        .filter((cell) => covers(range, y, cell.x, cell.width))
        .map((cell) => cell.text)
        .join('')
        .trimEnd(),
    );
  }
  return lines.join('\n');
}

/** The background an SGR sequence leaves, from the one before it: `49` for the terminal's own. */
function backgroundAfter(sequence: string, current: string) {
  const params = sequence.slice(2, -1).split(/[;:]/);
  let background = current;
  for (let at = 0; at < params.length; at++) {
    const param = params[at]!;
    if (param === '' || param === '0' || param === '49') background = '49';
    else if (/^(4[0-7]|10[0-7])$/.test(param)) background = param;
    else if (param === '48' && params[at + 1] === '2') {
      background = params.slice(at, at + 5).join(';');
      at += 4;
    } else if (param === '48' && params[at + 1] === '5') {
      background = params.slice(at, at + 3).join(';');
      at += 2;
    } else if (param === '38' && params[at + 1] === '2') at += 4;
    else if (param === '38' && params[at + 1] === '5') at += 2;
  }
  return background;
}

const SGR = /^\x1b\[[\d;:]*m$/;

/**
 * `frame` with the cells in `range` on `background` (`#rrggbb`), keeping their own colors, as a terminal shows a
 * selection.
 */
export function paintRange(frame: string, range: Range, background: string) {
  const on = `\x1b[48;2;${[1, 3, 5].map((at) => Number.parseInt(background.slice(at, at + 2), 16)).join(';')}m`;
  let current = '49';
  let painting = false;
  let out = '';
  let x = 0;
  let y = 0;
  const stop = () => {
    if (painting) out += `\x1b[${current}m`;
    painting = false;
  };
  for (const token of tokenize(frame)) {
    if ('escape' in token) {
      out += token.escape;
      if (SGR.test(token.escape)) {
        current = backgroundAfter(token.escape, current);
        // The frame's own colors go on inside the selection, all but its background.
        if (painting) out += on;
      }
      continue;
    }
    if (token.text === '\n') {
      stop();
      out += '\n';
      y++;
      x = 0;
      continue;
    }
    const width = stringWidth(token.text);
    const inside = width > 0 && covers(range, y, x, width);
    if (inside && !painting) {
      out += on;
      painting = true;
    } else if (!inside && width > 0) stop();
    out += token.text;
    x += width;
  }
  stop();
  return out;
}

/** What is selected, its color, and, once it is let go of, the text that was copied from it. */
export interface Selection {
  range: Range;
  background: string;
  text?: string;
}

/** Cursor moves and erases in a frame; a repaint puts each row in place itself. */
const PLACING = /\x1b\[[0-?]*[ -/]*[@-ln-~]/g;

/**
 * What Jinion last drew, read from what goes to the terminal, and the selection painted over it.
 *
 * Every frame Ink draws is a whole screen between the synchronized output markers, with no new lines before its first
 * row. The screen keeps the last one to read text from, paints the selection into each frame on its way out, and
 * repaints the last one when the selection changes. A selection whose text the next frame no longer shows there, as
 * when the conversation moves under it, is dropped.
 */
export class Screen {
  private frame = '';
  private pending: string | undefined;
  private selection: Selection | undefined;
  private readonly dropped = new Set<() => void>();

  constructor(private readonly out: (data: string) => void) {}

  /** Takes what would go to the terminal, and sends it on with the selection painted in. */
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

  /** The rows on screen, as cells. */
  cells() {
    return frameCells(this.frame);
  }

  /** Paints `selection` over what is on screen, or takes the one there away. */
  select(selection: Selection | undefined) {
    this.selection = selection;
    this.repaint();
  }

  /** Calls `listener` when a selection is dropped because what it covered changed. */
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

/**
 * Sends what is written to `stream` through a `Screen` on its way to the terminal. Ink writes text; anything else goes
 * by untouched.
 */
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
