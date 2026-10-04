import { describe, expect, it } from 'vitest';
import { abbreviated } from '../../src/lib/format.js';

describe('abbreviated', () => {
  it('tells a count short: as it is under a thousand, in K under a million, in M from there', () => {
    expect([850, 59_400, 200_000, 1_000_000, 1_500_000, 2_048_000].map(abbreviated)).toEqual(['850', '59K', '200K', '1M', '1.5M', '2M']);
  });
});
