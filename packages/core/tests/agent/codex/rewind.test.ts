import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FileUpdateChange, Turn } from '../../../src/agent/codex/protocol.js';
import { changesFrom, previewOf, restore } from '../../../src/agent/codex/rewind.js';
import { sandboxEach } from '../../support/sandbox.js';

const box = sandboxEach();

const file = (name: string) => join(box.project, name);
const read = (name: string) => readFileSync(file(name), 'utf8');
const update = (name: string, diff: string, move?: string): FileUpdateChange => ({ path: file(name), kind: { type: 'update', move_path: move ? file(move) : null }, diff });

const turn = (id: string, changes: FileUpdateChange[]): Turn => ({
  id,
  status: 'completed',
  error: null,
  items: [{ type: 'userMessage', id: `${id}-message` }, { type: 'fileChange', id: `${id}-patch`, changes, status: 'completed' }],
});

describe('Codex rewind', () => {
  it('undoes the patches from a turn on, newest first, and leaves the turns before it', () => {
    box.write(file('notes.txt'), 'hello\none\ntwo\n');
    box.write(file('two.txt'), '2\n');

    const turns = [
      turn('first', [update('notes.txt', '@@ -1,2 +1,2 @@\n hello\n-world\n+one\n')]),
      turn('second', [update('notes.txt', '@@ -1,2 +1,3 @@\n hello\n one\n+two\n'), { path: file('two.txt'), kind: { type: 'add' }, diff: '2\n' }]),
    ];

    const changes = changesFrom(turns, 'second')!;

    expect(previewOf(changes)).toEqual({ files: [file('notes.txt'), file('two.txt')], insertions: 0, deletions: 2 });

    restore(changes);

    expect(read('notes.txt')).toBe('hello\none\n');
    expect(existsSync(file('two.txt'))).toBe(false);
    expect(changesFrom(turns, 'gone')).toBeUndefined();
  });

  it('finds a hunk the user’s own edits moved, and brings back a deleted or moved file', () => {
    box.write(file('a.ts'), 'added by the user\nconst a = 2;\nend\n');
    box.write(file('b.ts'), 'new name\n');

    restore([
      update('a.ts', '@@ -1,2 +1,2 @@\n-const a = 1;\n+const a = 2;\n end\n'),
      { path: file('gone.md'), kind: { type: 'delete' }, diff: '# Gone\n' },
      update('old.ts', '@@ -1 +1 @@\n-old name\n+new name\n', 'b.ts'),
    ]);

    expect(read('a.ts')).toBe('added by the user\nconst a = 1;\nend\n');
    expect(read('gone.md')).toBe('# Gone\n');
    expect(read('old.ts')).toBe('old name\n');
    expect(existsSync(file('b.ts'))).toBe(false);
  });

  it('changes no file when one changed since in a way its patch can’t be undone on', () => {
    box.write(file('a.ts'), 'rewritten\n');
    box.write(file('b.ts'), 'two\n');

    expect(() =>
      restore([update('b.ts', '@@ -1 +1 @@\n-one\n+two\n'), update('a.ts', '@@ -1 +1 @@\n-before\n+after\n')]),
    ).toThrow(`${file('a.ts')} changed since, so its changes can't be undone`);

    expect(read('b.ts')).toBe('two\n');
  });
});
