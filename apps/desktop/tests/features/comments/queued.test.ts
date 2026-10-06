import { createStore } from 'jotai';
import { expect, test } from 'vitest';
import { rememberQueued, takeQueued } from '../../../src/renderer/features/comments/queued.js';
import { queuedCommentsAtom } from '../../../src/renderer/state/comments.js';

const comments = [{ id: 'a', path: 'a.ts', lines: [{ kind: 'added' as const, text: 'x', number: 1 }], text: 'Rename it', tab: 'git' as const }];

test('gives back the comments of a queued message taken back, once', () => {
  const store = createStore();

  rememberQueued(store, 's', [], { text: 'Fix\n\n1 comment on the diff of 1 file', typed: 'Fix', comments });

  expect(takeQueued(store, 's', 'Fix\n\n1 comment on the diff of 1 file')).toEqual({ text: 'Fix\n\n1 comment on the diff of 1 file', typed: 'Fix', comments });
  expect(takeQueued(store, 's', 'Fix\n\n1 comment on the diff of 1 file')).toBeUndefined();
});

test('forgets the comments of messages that left the queue', () => {
  const store = createStore();

  rememberQueued(store, 's', [], { text: 'sent', typed: '', comments });
  rememberQueued(store, 's', [{ text: 'waiting' }], { text: 'new', typed: '', comments });

  expect(store.get(queuedCommentsAtom).s?.map((each) => each.text)).toEqual(['new']);
});

test('keeps nothing for a message without comments', () => {
  const store = createStore();

  rememberQueued(store, 's', [], { text: 'plain', typed: 'plain', comments: [] });

  expect(store.get(queuedCommentsAtom)).toEqual({});
});
