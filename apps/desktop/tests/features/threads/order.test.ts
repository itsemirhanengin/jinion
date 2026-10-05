import { expect, test } from 'vitest';
import { keepOrder } from '../../../src/renderer/features/threads/order.js';

test('orders the threads first seen from the newest', () => {
  expect(keepOrder([], [{ id: 'old', at: 1 }, { id: 'new', at: 3 }, { id: 'mid', at: 2 }])).toEqual(['new', 'mid', 'old']);
});

test('keeps a known thread where it is when its time changes, as when it is opened', () => {
  expect(keepOrder(['a', 'b', 'c'], [{ id: 'a', at: 3 }, { id: 'b', at: 2 }, { id: 'c', at: 99 }])).toEqual(['a', 'b', 'c']);
});

test('puts a thread not seen before by its time among the known ones', () => {
  const known = ['a', 'b', 'c'];
  const threads = [{ id: 'a', at: 30 }, { id: 'b', at: 20 }, { id: 'c', at: 10 }];

  expect(keepOrder(known, [...threads, { id: 'new', at: 40 }])).toEqual(['new', 'a', 'b', 'c']);
  expect(keepOrder(known, [...threads, { id: 'late', at: 15 }])).toEqual(['a', 'b', 'late', 'c']);
});

test('keeps the place of a thread that is gone for a moment, as between closing and the saved list coming back', () => {
  expect(keepOrder(['a', 'b', 'c'], [{ id: 'a', at: 3 }, { id: 'c', at: 1 }])).toEqual(['a', 'b', 'c']);
});
