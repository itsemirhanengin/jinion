import { existsSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { followTranscript } from '../../../src/agent/claude/session-files.js';
import { sandboxEach } from '../../support/sandbox.js';

const box = sandboxEach();

const projects = () => join(box.home, '.claude', 'projects');
const slug = (path: string) => realpathSync(path).replace(/[^a-zA-Z0-9]/g, '-');

describe('followTranscript', () => {
  it('moves a conversation, with its subagents, under the folder it now works in', () => {
    box.write(join(projects(), '-gone-worktree', 'session-1.jsonl'), '{}\n');
    box.write(join(projects(), '-gone-worktree', 'session-1', 'subagents', 'agent-1.jsonl'), '{}\n');

    followTranscript('session-1', box.project);

    expect(existsSync(join(projects(), slug(box.project), 'session-1.jsonl'))).toBe(true);
    expect(existsSync(join(projects(), slug(box.project), 'session-1', 'subagents', 'agent-1.jsonl'))).toBe(true);
    expect(existsSync(join(projects(), '-gone-worktree', 'session-1.jsonl'))).toBe(false);
  });

  it('leaves a conversation that is already where it works, and one it can’t find', () => {
    box.write(join(projects(), slug(box.project), 'session-2.jsonl'), '{}\n');
    box.write(join(projects(), '-elsewhere', 'session-2.jsonl'), 'older');

    followTranscript('session-2', box.project);
    followTranscript('missing', box.project);

    expect(existsSync(join(projects(), '-elsewhere', 'session-2.jsonl'))).toBe(true);
  });
});
