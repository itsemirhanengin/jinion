import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { jinionHome } from '../../lib/paths.js';

const SDK = '@anthropic-ai/claude-agent-sdk';

export const claudeConfigDir = () => process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');

/** The `claude` the SDK ships and runs the agent with, found as the SDK finds it, so signing in needs no Claude Code. */
export function claudeBinary() {
  const require = createRequire(import.meta.resolve(SDK));
  const platform = `${process.platform}-${process.arch}`;
  const packages = process.platform === 'linux' ? [platform, `${platform}-musl`] : [platform];
  const file = process.platform === 'win32' ? 'claude.exe' : 'claude';

  for (const name of packages) {
    try {
      const path = require.resolve(`${SDK}-${name}/${file}`);
      if (existsSync(path)) return path;
    } catch {}
  }

  throw new Error(`no claude for ${platform} came with ${SDK}; reinstall jinion without --omit=optional`);
}

export const accountsDir = () => join(jinionHome(), 'accounts', 'claude');

/** `''` for `dir` itself, `undefined` outside it. */
export function within(path: string, dir: string) {
  const from = relative(dir, resolve(dir, path));

  return from.startsWith('..') || isAbsolute(from) ? undefined : from;
}

export const inside = (path: string, dir: string) => within(path, dir) !== undefined;

/** Claude Code's own plan-mode bookkeeping in a config folder, not a change to the user's files. */
export function isPlanFile(path: string) {
  const configs = [join(homedir(), '.claude'), claudeConfigDir()];
  if (configs.some((folder) => inside(path, join(folder, 'plans')))) return true;

  const [account, folder, ...rest] = relative(accountsDir(), resolve(path)).split(sep);

  return account !== '..' && !isAbsolute(account ?? '') && folder === 'plans' && rest.length > 0;
}
