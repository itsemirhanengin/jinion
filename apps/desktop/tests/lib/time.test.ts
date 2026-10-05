import { expect, test } from 'vitest';
import { ago, took } from '../../src/renderer/lib/time.js';

test('says how long ago as short as the sidebar wants it', () => {
  const now = Date.UTC(2026, 9, 5);

  expect(ago(now - 25_000, now)).toBe('25s');
  expect(ago(now - 3 * 60_000, now)).toBe('3m');
  expect(ago(now - 2 * 3_600_000, now)).toBe('2h');
  expect(ago(now - 4 * 86_400_000, now)).toBe('4d');
  expect(ago(now - 45 * 86_400_000, now)).toBe('1mo');
});

test('says how long something took', () => {
  expect(took(400)).toBe('1s');
  expect(took(72_000)).toBe('1m 12s');
});
