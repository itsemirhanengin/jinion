import { describe, expect, it } from 'vitest';
import { cleanTitle } from '../../src/agent/titles.js';

describe('cleanTitle', () => {
  it('keeps the first line, without a label, quotes or a closing period', () => {
    expect(cleanTitle('Title: `Fix the flaky login test`.\nBecause…')).toBe('Fix the flaky login test');
    expect(cleanTitle('  \n')).toBeUndefined();
    expect(cleanTitle('a'.repeat(100))).toHaveLength(80);
  });

  it('has no title when the model explained itself instead', () => {
    expect(cleanTitle('This is a greeting with no work yet, so I will name it after the greeting itself')).toBeUndefined();
  });
});
