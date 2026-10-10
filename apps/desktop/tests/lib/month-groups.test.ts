import { describe, expect, it } from 'vitest';
import { monthOf } from '../../src/renderer/lib/month-groups.js';

const now = new Date(2026, 9, 10, 15, 0);
const at = (year: number, month: number, day: number) => new Date(year, month, day, 12).getTime();

describe('monthOf', () => {
  it('names the months of this year alone', () => {
    expect(monthOf(at(2026, 9, 10), now)).toBe('October');
    expect(monthOf(at(2026, 9, 1), now)).toBe('October');
    expect(monthOf(at(2026, 0, 31), now)).toBe('January');
  });

  it('adds the year to an earlier year’s month', () => {
    expect(monthOf(at(2025, 11, 31), now)).toBe('December 2025');
    expect(monthOf(at(2023, 2, 1), now)).toBe('March 2023');
  });
});
