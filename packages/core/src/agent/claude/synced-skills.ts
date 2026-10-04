import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import type { Socket } from 'node:net';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { readJson } from '../../lib/json-file.js';
import { accountEnv, configDirOf } from './accounts.js';
import { claudeBinary, claudeConfigDir } from './paths.js';

const SYNC_MS = 120_000;
const CHECK_MS = 1_000;

/** Claude Code syncs these only with its user settings on, which Jinion keeps off; this process turns them on for that alone. */
const SYNC_ARGS = [
  '-p',
  '--input-format',
  'stream-json',
  '--output-format',
  'stream-json',
  '--verbose',
  '--setting-sources',
  'user',
  '--settings',
  JSON.stringify({ disableAllHooks: true }),
  '--strict-mcp-config',
  '--mcp-config',
  JSON.stringify({ mcpServers: {} }),
];

type ClaudeState = { oauthAccount?: { accountUuid?: string; organizationUuid?: string } };

/** The skills of the account's claude.ai organization, as Claude Code last synced them. */
export function syncedSkillsDir(account: string) {
  const dir = configDirOf(account) ?? process.env.CLAUDE_CONFIG_DIR;
  const { oauthAccount } = readJson<ClaudeState>(dir ? join(dir, '.claude.json') : join(homedir(), '.claude.json'), {});
  if (!oauthAccount?.accountUuid || !oauthAccount.organizationUuid) return undefined;

  return join(syncedRoot(account), `${oauthAccount.organizationUuid}_${oauthAccount.accountUuid}`);
}

/**
 * Runs Claude Code's own sync without a conversation: it starts at launch, waits for a message that never comes, and
 * stops once a round is done or after two minutes. A round with nothing new leaves no mark, hence the limit.
 */
export function syncSkills(account: string) {
  const started = Date.now();
  const root = syncedRoot(account);

  const sync = spawn(claudeBinary(), SYNC_ARGS, {
    env: { ...process.env, ...accountEnv(account) },
    cwd: tmpdir(),
    stdio: ['pipe', 'ignore', 'ignore'],
  });

  const check = setInterval(() => {
    if (Date.now() - started <= SYNC_MS && !roundDone(root, started)) return;

    clearInterval(check);
    sync.stdin.end();
  }, CHECK_MS);

  // Jinion can quit meanwhile: its end closes the pipe, which ends the sync too.
  check.unref();
  sync.unref();
  (sync.stdin as Socket).unref();
  sync.on('error', () => clearInterval(check));
  sync.on('exit', () => clearInterval(check));
}

const syncedRoot = (account: string) => join(configDirOf(account) ?? claudeConfigDir(), 'skills', 'synced');

function roundDone(root: string, since: number) {
  if (!existsSync(root)) return false;

  return readdirSync(root).some((bucket) => {
    const mark = join(root, bucket, '.last-complete-round');

    return existsSync(mark) && statSync(mark).mtimeMs >= since;
  });
}
