import { describe, expect, it } from 'vitest';
import { fuzzyFilter, fuzzyMatch } from '../../src/utils/fuzzy.js';

describe('fuzzyMatch', () => {
  it('matches a subsequence, case-insensitively, with the positions', () => {
    expect(fuzzyMatch('StatusLine', 'stl')?.positions).toEqual([0, 1, 6]);
    expect(fuzzyMatch('model', 'xyz')).toBeUndefined();
  });

  it('scores runs and word starts higher', () => {
    const run = fuzzyMatch('resume', 'res')!.score;
    const spread = fuzzyMatch('remember-us', 'res')!.score;

    expect(run).toBeGreaterThan(spread);
    expect(fuzzyMatch('make-responsive', 'resp')!.score).toBeGreaterThan(fuzzyMatch('react-best-practices', 'resp')!.score);
  });
});

describe('fuzzyFilter', () => {
  const names = ['model', 'mode', 'memory', 'mcp'];

  it('keeps everything in order for an empty query', () => {
    expect(fuzzyFilter(names, ' ', (name) => name).map((match) => match.item)).toEqual(names);
  });

  it('keeps matches, best first, ties in their order', () => {
    expect(fuzzyFilter(names, 'mod', (name) => name).map((match) => match.item)).toEqual(['model', 'mode']);
  });
});
