import stringWidth from 'string-width';
import { OUTPUT_ESCAPE } from '../utils/ansi.js';
import { channelsOf } from '../utils/color.js';

export interface Point {
  x: number;
  y: number;
}

/** Both ends included, in reading order. */
export interface Range {
  from: Point;
  to: Point;
}

export interface Cell {
  x: number;
  width: number;
  text: string;
}

type Token = { escape: string } | { text: string };

const segmenter = new Intl.Segmenter();

function tokenize(data: string): Token[] {
  const tokens: Token[] = [];
  let at = 0;
  while (at < data.length) {
    OUTPUT_ESCAPE.lastIndex = at;
    const sequence = data[at] === '\x1b' ? OUTPUT_ESCAPE.exec(data) : null;
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

export function orderRange(a: Point, b: Point): Range {
  return a.y < b.y || (a.y === b.y && a.x <= b.x) ? { from: a, to: b } : { from: b, to: a };
}

function covers(range: Range, y: number, x: number, width: number) {
  if (y < range.from.y || y > range.to.y) return false;
  const start = y === range.from.y ? range.from.x : 0;
  const end = y === range.to.y ? range.to.x : Number.POSITIVE_INFINITY;
  return x + width - 1 >= start && x <= end;
}

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

export function paintRange(frame: string, range: Range, background: string) {
  const on = `\x1b[48;2;${channelsOf(background).join(';')}m`;
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
