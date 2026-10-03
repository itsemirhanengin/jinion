import { existsSync, mkdirSync, readdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { accountsDir, claudeConfigDir } from './paths.js';

export const DEFAULT_ACCOUNT = 'default';

const VALID_NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/i;

/** Each account is a Claude Code config folder of its own. Jinion never sees the credentials; Claude Code stores them. */
export const configDirOf = (name: string) => (name === DEFAULT_ACCOUNT ? undefined : join(accountsDir(), name));

export function accountEnv(name: string) {
  const dir = configDirOf(name);

  return dir ? { CLAUDE_CONFIG_DIR: dir } : {};
}

export function accountNames() {
  const named = existsSync(accountsDir())
    ? readdirSync(accountsDir(), { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && VALID_NAME.test(entry.name) && entry.name !== DEFAULT_ACCOUNT)
        .map((entry) => entry.name)
        .sort()
    : [];

  return [DEFAULT_ACCOUNT, ...named];
}

export function configDirs() {
  const accounts = accountNames().flatMap((name) => configDirOf(name) ?? []);

  return [...new Set([claudeConfigDir(), ...accounts])];
}

/** The account's `projects` links to the default one, so a conversation can carry on after a switch. */
export function makeConfigDir(name: string) {
  const dir = configDirOf(name);
  if (!dir) return;

  mkdirSync(dir, { recursive: true });
  const projects = join(claudeConfigDir(), 'projects');

  mkdirSync(projects, { recursive: true });
  if (!existsSync(join(dir, 'projects'))) symlinkSync(projects, join(dir, 'projects'), 'dir');
}

export function checkName(name: string) {
  return VALID_NAME.test(name) ? undefined : 'Use letters, digits, - or _, up to 32 characters.';
}

/** Claude Code says `team` in one place and `Claude Team` in another; both read as `Team`. */
export function planName(type: string | undefined) {
  const plan = type?.replace(/^claude\s+/i, '').trim();

  return plan ? plan[0]!.toUpperCase() + plan.slice(1).toLowerCase() : undefined;
}
