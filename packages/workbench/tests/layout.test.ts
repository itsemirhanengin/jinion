import { describe, expect, it } from 'vitest';
import { closeTab, emptyLayout, keyOf, openTab, pinTab, splitTab, toggleActivity, toggleSidebar } from '../src/layout.js';

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
