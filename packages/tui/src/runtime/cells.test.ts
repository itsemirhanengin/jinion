import { describe, expect, it } from 'vitest';
import { frameCells, orderRange, paintRange, rangeText } from './cells.js';

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
