import { describe, expect, it } from 'vitest';
import { frameCells, orderRange, paintRange, rangeText, Screen } from './screen.js';
import { wordAt } from './selection.js';

const BEGIN = '\x1b[?2026h';
const END = '\x1b[?2026l';
const BLUE = '#264f78';
const ON = '\x1b[48;2;38;79;120m';

describe('frameCells', () => {
  it('reads the rows of a frame as cells, wide ones taking two columns, without escape sequences', () => {
    const rows = frameCells('\x1b[2K\x1b[1A\x1b[31mab\x1b[39m\n日x');
    expect(rows[0]!.map((cell) => [cell.x, cell.text])).toEqual([
      [0, 'a'],
      [1, 'b'],
    ]);
    expect(rows[1]!.map((cell) => [cell.x, cell.width, cell.text])).toEqual([
      [0, 2, '日'],
      [2, 1, 'x'],
    ]);
  });
});

describe('rangeText', () => {
  it('takes the rest of the first row, whole rows between, and the start of the last, without trailing spaces', () => {
    const rows = frameCells('one two  \nthree    \nfour five');
    expect(rangeText(rows, orderRange({ x: 3, y: 2 }, { x: 4, y: 0 }))).toBe('two\nthree\nfour');
  });
});

describe('paintRange', () => {
  it('puts the selection behind the cells, keeping their colors and the background after them', () => {
    const painted = paintRange('\x1b[48;2;1;2;3mab\x1b[31mcd\x1b[39mef\x1b[49m', { from: { x: 1, y: 0 }, to: { x: 3, y: 0 } }, BLUE);
    expect(painted).toBe(`\x1b[48;2;1;2;3ma${ON}b\x1b[31m${ON}cd\x1b[39m${ON}\x1b[48;2;1;2;3mef\x1b[49m`);
  });

  it('stops at the end of each row and starts again on the next', () => {
    const painted = paintRange('ab\ncd', { from: { x: 1, y: 0 }, to: { x: 0, y: 1 } }, BLUE);
    expect(painted).toBe(`a${ON}b\x1b[49m\n${ON}c\x1b[49md`);
  });
});

describe('Screen', () => {
  it('paints the selection into the frames on their way out, and drops it once the text under it changes', () => {
    const out: string[] = [];
    const screen = new Screen((data) => out.push(data));
    screen.write(`\x1b]22;pointer\x07${BEGIN}`);
    screen.write('hello\nworld');
    screen.write(END);
    expect(out).toEqual(['\x1b]22;pointer\x07', `${BEGIN}hello\nworld${END}`]);

    const range = { from: { x: 0, y: 1 }, to: { x: 4, y: 1 } };
    let dropped = 0;
    screen.onDrop(() => dropped++);
    screen.select({ range, background: BLUE, text: 'world' });
    expect(out.at(-1)).toContain(`${ON}world`);

    screen.write(`${BEGIN}hello\nworld${END}`);
    expect(out.at(-1)).toBe(`${BEGIN}hello\n${ON}world\x1b[49m${END}`);
    screen.write(`${BEGIN}world\nagain${END}`);
    expect(out.at(-1)).toBe(`${BEGIN}world\nagain${END}`);
    expect(dropped).toBe(1);
  });

  it('keeps the last frame when only the cursor moves', () => {
    const screen = new Screen(() => {});
    screen.write(`${BEGIN}hello${END}`);
    screen.write(`${BEGIN}\x1b[2;3H\x1b[?25h${END}`);
    expect(rangeText(screen.cells(), { from: { x: 0, y: 0 }, to: { x: 9, y: 0 } })).toBe('hello');
  });
});

describe('wordAt', () => {
  const row = frameCells('see src/server.ts, or https://jinion.co/docs. ok')[0]!;
  const word = (x: number) => {
    const span = wordAt(row, x);
    return span && row.filter((cell) => cell.x >= span.from && cell.x <= span.to).map((cell) => cell.text).join('');
  };

  it('takes a path as one word, as iTerm2 does', () => {
    expect(word(6)).toBe('src/server.ts');
    expect(word(1)).toBe('see');
  });

  it('takes a whole URL, without the punctuation after it', () => {
    expect(word(30)).toBe('https://jinion.co/docs');
  });

  it('takes one cell between words', () => {
    expect(word(3)).toBe(' ');
  });
});
