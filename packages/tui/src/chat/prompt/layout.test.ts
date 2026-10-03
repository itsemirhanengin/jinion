import { describe, expect, it } from 'vitest';
import { layout, offsetAt, rowOf } from './layout.js';

const texts = (value: string, width: number) => layout(value, width).map((row) => value.slice(row.start, row.end));

describe('layout', () => {
  it('breaks rows at newlines and where a line runs past the width, wide characters taking two columns', () => {
    expect(texts('abcdef\ngh', 4)).toEqual(['abcd', 'ef', 'gh']);
    expect(texts('ab日本', 4)).toEqual(['ab日', '本']);
    expect(texts('', 4)).toEqual(['']);
    expect(texts('ab\n', 4)).toEqual(['ab', '']);
  });
});

describe('rowOf', () => {
  it('puts the cursor at a wrap on the next row, and at a newline on the row it ends', () => {
    const wrapped = layout('abcdef', 4);

    expect(rowOf(wrapped, 3)).toBe(0);
    expect(rowOf(wrapped, 4)).toBe(1);
    expect(rowOf(wrapped, 6)).toBe(1);
    expect(rowOf(layout('ab\ncd', 4), 2)).toBe(0);
  });
});

describe('offsetAt', () => {
  it('finds the offset at a column, or the end of a shorter row', () => {
    const value = 'a日b\nxy';
    const [first, second] = layout(value, 10);

    expect(offsetAt(value, first!, 0)).toBe(0);
    expect(offsetAt(value, first!, 2)).toBe(1);
    expect(offsetAt(value, first!, 3)).toBe(2);
    expect(offsetAt(value, second!, 5)).toBe(value.length);
  });
});
