import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accountsDir, claudeBinary, isPlanFile, within } from '../../../src/agent/claude/paths.js';

describe('claudeBinary', () => {
  it('finds the claude that came with the SDK, which runs with nothing on the PATH', () => {
    const binary = claudeBinary();

    expect(binary).toContain(`claude-agent-sdk-${process.platform}-${process.arch}`);
    expect(execFileSync(binary, ['--version'], { env: { PATH: '' }, encoding: 'utf8' })).toMatch(/\(Claude Code\)/);
  });
});

describe('isPlanFile', () => {
  it('knows the plans of Claude Code’s own login and of every account', () => {
    expect(isPlanFile(join(homedir(), '.claude', 'plans', 'a.md'))).toBe(true);
    expect(isPlanFile(join(accountsDir(), 'work', 'plans', 'a.md'))).toBe(true);
    expect(isPlanFile(join(accountsDir(), 'work', 'settings.json'))).toBe(false);
    expect(isPlanFile(join(homedir(), '.claude', 'settings.json'))).toBe(false);
    expect(isPlanFile('/work/project/plans/a.md')).toBe(false);
  });
});

describe('within', () => {
  it('gives a path relative to a folder it is in, and nothing for one outside', () => {
    expect(within('/work/project/src/a.ts', '/work/project')).toBe('src/a.ts');
    expect(within('src/a.ts', '/work/project')).toBe('src/a.ts');
    expect(within('/work/project', '/work/project')).toBe('');
    expect(within('/work/other/a.ts', '/work/project')).toBeUndefined();
    expect(within('../other', '/work/project')).toBeUndefined();
  });
});
