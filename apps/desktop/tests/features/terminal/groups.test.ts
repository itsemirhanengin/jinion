import { expect, test } from 'vitest';
import { groupOf, reconcile, splitBeside } from '../../../src/renderer/features/terminal/groups.js';

test('keeps the groups to the terminals there are, a new one in a group of its own', () => {
  expect(reconcile([['a', 'b'], ['c']], ['a', 'b', 'c', 'd'])).toEqual([['a', 'b'], ['c'], ['d']]);
  expect(reconcile([['a', 'b'], ['c']], ['b', 'd'])).toEqual([['b'], ['d']]);
  expect(reconcile([], ['a'])).toEqual([['a']]);
});

test('splits a terminal by putting the new one beside it, in its group', () => {
  const groups = splitBeside([['a', 'b'], ['c']], 'a', 'e');

  expect(groups).toEqual([['a', 'e', 'b'], ['c']]);
  expect(reconcile(groups, ['a', 'b', 'c', 'e'])).toEqual(groups);
  expect(groupOf(groups, 'e')).toEqual(['a', 'e', 'b']);
  expect(groupOf(groups, undefined)).toBeUndefined();
});

test('moves a split terminal out of the group of its own it got as the list came first', () => {
  expect(splitBeside([['a'], ['c'], ['e']], 'a', 'e')).toEqual([['a', 'e'], ['c']]);
});
