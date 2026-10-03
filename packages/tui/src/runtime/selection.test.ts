import { describe, expect, it } from 'vitest';
import { frameCells } from './cells.js';
import { wordAt } from './selection.js';

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
