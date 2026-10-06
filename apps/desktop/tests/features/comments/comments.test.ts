import type { DiffLine } from '@jinion/ui/chat';
import { expect, test } from 'vitest';
import { placeComments, withComments } from '../../../src/renderer/features/comments/comments.js';

const comment = (id: string, path: string, lines: DiffLine[], text: string) => ({ id, path, lines, text, tab: 'changes' as const });

const renamed: DiffLine[] = [
  { kind: 'removed', text: 'const a = 1;', number: 3 },
  { kind: 'added', text: 'const total = 1;', number: 3 },
];

test('finds a comment again where the file moved its lines', () => {
  const lines: DiffLine[] = [{ kind: 'added', text: 'import x;', number: 1 }, { kind: 'context', text: '', number: 2 }, ...renamed.map((line) => ({ ...line, number: 4 }))];

  expect(placeComments([comment('a', 'src/a.ts', renamed, 'Call it sum')], lines)).toEqual([{ id: 'a', text: 'Call it sum', from: 2, to: 3 }]);
});

test('leaves a comment outdated once its lines are gone', () => {
  expect(placeComments([comment('a', 'src/a.ts', renamed, 'Call it sum')], [{ kind: 'context', text: 'other', number: 1 }])).toEqual([{ id: 'a', text: 'Call it sum' }]);
});

test('sends the comments with the lines they are on and shows how many there are', () => {
  const submission = withComments({ text: 'Fix these' }, [
    comment('a', 'src/a.ts', renamed, 'Call it sum'),
    comment('b', 'src/a.ts', [{ kind: 'removed', text: 'old();', number: 9 }], 'Keep this call'),
    comment('c', 'src/b.ts', [{ kind: 'context', text: 'x', number: 7 }], 'Why here?'),
  ]);

  expect(submission.text).toBe('Fix these\n\n3 comments on the diff of 2 files');
  expect(submission.prompt?.text).toContain('Fix these\n\nI left comments on the diff.');
  expect(submission.prompt?.text).toContain('src/a.ts, line 3:\n```diff\n-const a = 1;\n+const total = 1;\n```\nCall it sum');
  expect(submission.prompt?.text).toContain('src/a.ts, the removed line 9:');
  expect(submission.prompt?.text).toContain('src/b.ts, line 7:');
});

test('keeps the images and sends comments without text of their own', () => {
  const image = { mediaType: 'image/png', data: 'png' };
  const submission = withComments({ text: '', prompt: { text: '', images: [image] } }, [comment('a', 'a.ts', renamed, 'Call it sum')]);

  expect(submission.text).toBe('1 comment on the diff of 1 file');
  expect(submission.prompt?.images).toEqual([image]);
  expect(submission.prompt?.text.startsWith('I left comments')).toBe(true);
});
