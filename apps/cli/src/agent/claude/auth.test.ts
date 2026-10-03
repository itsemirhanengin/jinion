import { chmodSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sandboxEach } from '../../test/sandbox.js';
import { removeAccount } from './auth.js';
import { accountsDir } from './paths.js';

/** Stands in for `claude`: `auth logout` deletes the login unless `KEEP_LOGIN` is set, and every call is logged. */
const FAKE_CLAUDE = `#!/bin/sh
echo "$CLAUDE_CONFIG_DIR $*" >> "$CLAUDE_LOG"
case "$*" in
  "auth logout") [ -z "$KEEP_LOGIN" ] && rm -f "$CLAUDE_CONFIG_DIR/.credentials.json" ;;
  "auth status --json") [ -f "$CLAUDE_CONFIG_DIR/.credentials.json" ] && echo '{"loggedIn":true}' || { echo '{"loggedIn":false}'; exit 1; } ;;
esac
`;

const box = sandboxEach();
let path: string | undefined;

beforeEach(() => {
  const bin = join(box.home, 'bin');
  chmodSync(box.write(join(bin, 'claude'), FAKE_CLAUDE), 0o755);
  path = process.env.PATH;
  process.env.PATH = `${bin}:${path}`;
  process.env.CLAUDE_LOG = join(box.home, 'claude.log');
});

afterEach(() => {
  process.env.PATH = path;
  delete process.env.CLAUDE_LOG;
  delete process.env.KEEP_LOGIN;
});

function signedIn(name: string) {
  const dir = join(accountsDir(), name);
  const shared = join(box.home, '.claude', 'projects');
  box.write(join(shared, 'project', 'session.jsonl'), '{}\n');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.credentials.json'), '{}');
  return { dir, shared };
}

describe('removeAccount', () => {
  it('signs the account out through Claude Code, then deletes its folder, keeping the shared conversations', async () => {
    const { dir, shared } = signedIn('work');
    symlinkSync(shared, join(dir, 'projects'), 'dir');

    await removeAccount('work');

    expect(existsSync(dir)).toBe(false);
    expect(existsSync(join(shared, 'project', 'session.jsonl'))).toBe(true);
    expect(readFileSync(process.env.CLAUDE_LOG!, 'utf8').split('\n')[0]).toBe(`${dir} auth logout`);
  });

  it('keeps an account Claude Code couldn’t sign out, so its login isn’t left behind', async () => {
    const { dir } = signedIn('work');
    process.env.KEEP_LOGIN = '1';
    await expect(removeAccount('work')).rejects.toThrow("Claude Code couldn't sign it out");
    expect(existsSync(dir)).toBe(true);
  });

  it('keeps Claude Code’s own login, and says when there is no such account', async () => {
    await expect(removeAccount('default')).rejects.toThrow("Claude Code's own login");
    await expect(removeAccount('nobody')).rejects.toThrow('there is no account called nobody');
  });
});
