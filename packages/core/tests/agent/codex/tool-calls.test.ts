import { describe, expect, it } from 'vitest';
import type { ThreadItem } from '../../../src/agent/codex/protocol.js';
import { commandCall, commandResult, editCall, unwrapShell } from '../../../src/agent/codex/tool-calls.js';

type CommandItem = Extract<ThreadItem, { type: 'commandExecution' }>;

const command = (shell: string, actions: CommandItem['commandActions'], output = ''): CommandItem => ({
  type: 'commandExecution',
  id: 'c1',
  command: shell,
  cwd: '/project',
  status: 'completed',
  commandActions: actions,
  aggregatedOutput: output,
  exitCode: 0,
  durationMs: 12,
});

describe('Codex tool calls', () => {
  it('shows a command without the shell Codex runs it in', () => {
    expect(unwrapShell("/bin/zsh -lc 'ls packages'")).toBe('ls packages');
    expect(unwrapShell(`/bin/bash -lc "printf 'a\\\\n' > \\"x y\\""`)).toBe(`printf 'a\\n' > "x y"`);
    expect(unwrapShell(`/bin/zsh -lc 'echo '"'"'hi'"'"''`)).toBe("echo 'hi'");
    expect(unwrapShell('npm test')).toBe('npm test');
  });

  it('shows what a command does when Codex parsed it: reads, a search, a listing, or else the command', () => {
    const read = (path: string) => ({ type: 'read' as const, command: `cat ${path}`, name: path, path: `/project/${path}` });

    expect(commandCall(command("/bin/zsh -lc 'cat a && cat b'", [read('a'), read('b')]))).toEqual({
      name: 'read',
      input: { files: [{ path: '/project/a' }, { path: '/project/b' }] },
    });

    expect(commandCall(command('/bin/zsh -lc \'rg -n "todo" src\'', [{ type: 'search', command: 'rg -n "todo" src', query: 'todo', path: 'src' }]))).toEqual({
      name: 'grep',
      input: { pattern: 'todo', path: 'src' },
    });

    expect(commandCall(command("/bin/zsh -lc 'ls src'", [{ type: 'listFiles', command: 'ls src', path: 'src' }]))).toEqual({ name: 'glob', input: { pattern: 'src' } });

    expect(commandCall(command("/bin/zsh -lc 'npm test && git status'", [{ type: 'unknown', command: 'npm test && git status' }]))).toEqual({
      name: 'bash',
      input: { command: 'npm test && git status' },
    });
  });

  it('reads a search’s matches out of what it printed', () => {
    const item = command("/bin/zsh -lc 'rg -n todo'", [{ type: 'search', command: 'rg -n todo', query: 'todo', path: null }], 'src/a.ts:3:// todo: fix\nsrc/b.ts:10:  todo()\n');

    expect(commandResult(commandCall(item), item)).toEqual({
      matches: [
        { file: 'src/a.ts', line: 3, text: '// todo: fix' },
        { file: 'src/b.ts', line: 10, text: '  todo()' },
      ],
    });
  });

  it('shows each file of a patch as an edit, a new or deleted one as all lines added or removed', () => {
    expect(editCall({ path: '/project/new.md', kind: { type: 'add' }, diff: '# Hi\nthere\n' })).toEqual({
      name: 'edit',
      input: { path: '/project/new.md', patch: '@@ -0,0 +1,2 @@\n+# Hi\n+there', created: true },
    });

    expect(editCall({ path: '/project/old.md', kind: { type: 'delete' }, diff: 'gone\n' })).toEqual({
      name: 'edit',
      input: { path: '/project/old.md', patch: '@@ -1,1 +0,0 @@\n-gone' },
    });

    expect(editCall({ path: '/project/a.ts', kind: { type: 'update', move_path: '/project/b.ts' }, diff: '@@ -1 +1 @@\n-a\n+b\n' })).toEqual({
      name: 'edit',
      input: { path: '/project/b.ts', patch: '@@ -1 +1 @@\n-a\n+b' },
    });
  });
});
