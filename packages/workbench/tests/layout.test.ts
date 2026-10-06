import { describe, expect, it } from 'vitest';
import {
  canSplit,
  closeTab,
  emptyLayout,
  keyOf,
  moveTab,
  openTab,
  pinTab,
  resizeSplit,
  splitTab,
  splitTo,
  toggleActivity,
  toggleSidebar,
} from '../src/layout.js';

const thread = { kind: 'thread', id: 'a' };
const other = { kind: 'thread', id: 'b' };
const diff = (id: string) => ({ kind: 'diff', id });

function keys(layout: typeof emptyLayout, group = 0) {
  return layout.groups[group]?.tabs.map(keyOf);
}

describe('openTab', () => {
  it('opens after the active tab and shows it', () => {
    const layout = openTab(openTab(openTab(emptyLayout, thread), other), diff('x'));

    expect(keys(layout)).toEqual(['thread:a', 'thread:b', 'diff:x']);
    expect(layout.groups[0]!.active).toBe('diff:x');
  });

  it('shows a tab already open rather than opening it twice', () => {
    const layout = openTab(openTab(openTab(emptyLayout, thread), other), thread);

    expect(keys(layout)).toEqual(['thread:a', 'thread:b']);
    expect(layout.groups[0]!.active).toBe('thread:a');
  });

  it('puts a preview in the place of the one before', () => {
    const first = openTab(openTab(emptyLayout, thread), diff('x'), { preview: true });
    const layout = openTab(first, diff('y'), { preview: true });

    expect(keys(layout)).toEqual(['thread:a', 'diff:y']);
    expect(layout.groups[0]!.preview).toBe('diff:y');
  });

  it('keeps a preview once it is opened for good', () => {
    const preview = openTab(emptyLayout, diff('x'), { preview: true });

    expect(openTab(preview, diff('x')).groups[0]!.preview).toBeUndefined();
    expect(pinTab(preview, 'diff:x').groups[0]!.preview).toBeUndefined();
  });

  it('opens a second group, never a third', () => {
    const layout = openTab(openTab(openTab(emptyLayout, thread), other, { group: 1 }), diff('x'), { group: 2 });

    expect(layout.groups).toHaveLength(2);
    expect(keys(layout, 1)).toEqual(['thread:b', 'diff:x']);
    expect(layout.focused).toBe(1);
  });
});

describe('closeTab', () => {
  it('shows the tab to the right, then the one to the left', () => {
    const three = openTab(openTab(openTab(emptyLayout, thread), other), diff('x'));
    const middle = closeTab(openTab(three, other), 'thread:b');

    expect(middle.groups[0]!.active).toBe('diff:x');
    expect(closeTab(three, 'diff:x').groups[0]!.active).toBe('thread:b');
  });

  it('closes a second group once it is empty', () => {
    const layout = closeTab(openTab(openTab(emptyLayout, thread), other, { group: 1 }), 'thread:b');

    expect(layout.groups).toHaveLength(1);
    expect(layout.focused).toBe(0);
  });
});

describe('splitTab', () => {
  it('moves a tab into a group beside, and back when it is that group last', () => {
    const split = splitTab(openTab(openTab(emptyLayout, thread), other), 'thread:b');

    expect(keys(split, 0)).toEqual(['thread:a']);
    expect(keys(split, 1)).toEqual(['thread:b']);
    expect(keys(splitTab(split, 'thread:b'))).toEqual(['thread:a', 'thread:b']);
  });

  it('leaves a lone tab where it is', () => {
    const layout = openTab(emptyLayout, thread);

    expect(splitTab(layout, 'thread:a')).toBe(layout);
  });
});

describe('dragging a tab', () => {
  const three = openTab(openTab(openTab(emptyLayout, thread), other), diff('x'));

  it('puts it in a group of its own on the side it was dropped, half the room each', () => {
    const below = splitTo(three, 'thread:a', 'bottom');

    expect(keys(below, 0)).toEqual(['thread:b', 'diff:x']);
    expect(keys(below, 1)).toEqual(['thread:a']);
    expect(below).toMatchObject({ split: 'column', share: 0.5, focused: 1 });

    const left = splitTo(three, 'diff:x', 'left');

    expect(keys(left, 0)).toEqual(['diff:x']);
    expect(left).toMatchObject({ split: 'row', focused: 0 });
  });

  it('makes no third group, and no split of a group with one tab', () => {
    const split = splitTo(three, 'thread:a', 'right');

    expect(canSplit(split, 'thread:b')).toBe(false);
    expect(splitTo(split, 'thread:b', 'left')).toBe(split);
    expect(canSplit(openTab(emptyLayout, thread), 'thread:a')).toBe(false);
  });

  it('turns two groups around when the lone tab of one is dropped on the other’s edge', () => {
    const below = splitTo(splitTo(three, 'thread:a', 'right'), 'thread:a', 'top');

    expect(keys(below, 0)).toEqual(['thread:a']);
    expect(keys(below, 1)).toEqual(['thread:b', 'diff:x']);
    expect(below.split).toBe('column');
  });

  it('moves it into another group at a place, closing the group it empties', () => {
    const split = splitTo(three, 'thread:a', 'right');
    const moved = moveTab(split, 'thread:a', 0, 1);

    expect(moved.groups).toHaveLength(1);
    expect(keys(moved)).toEqual(['thread:b', 'thread:a', 'diff:x']);
    expect(moved).toMatchObject({ focused: 0, split: undefined, share: undefined });
    expect(moved.groups[0]!.active).toBe('thread:a');
  });

  it('moves it along its own row', () => {
    expect(keys(moveTab(three, 'thread:a', 0, 3))).toEqual(['thread:b', 'diff:x', 'thread:a']);
    expect(keys(moveTab(three, 'diff:x', 0, 0))).toEqual(['diff:x', 'thread:a', 'thread:b']);
  });

  it('keeps each group a fifth of the room at least', () => {
    expect(resizeSplit(three, 0.05).share).toBe(0.2);
    expect(resizeSplit(three, 0.9).share).toBe(0.8);
  });
});

describe('the sidebar', () => {
  it('closes when its activity is picked again, and reopens on the last one', () => {
    const git = toggleActivity(emptyLayout, 'git');
    const closed = toggleActivity(git, 'git');

    expect(git.activity).toBe('git');
    expect(closed.activity).toBeUndefined();
    expect(toggleSidebar(closed, 'threads').activity).toBe('git');
    expect(toggleSidebar(emptyLayout, 'threads').activity).toBe('threads');
  });
});
