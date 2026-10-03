import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { accountsDir } from './accounts.js';

type Input = Record<string, unknown>;

/**
 * Claude Code writes plans to `plans/` in its config folder in plan mode, `~/.claude` or an account's; that's its own
 * bookkeeping, not a change to the user's files.
 */
export function isPlanFile(path: string) {
  const configs = [join(homedir(), '.claude'), process.env.CLAUDE_CONFIG_DIR].filter((folder) => folder !== undefined);
  if (configs.some((folder) => inside(path, join(folder, 'plans')))) return true;
  const [account, folder, ...rest] = relative(accountsDir(), resolve(path)).split(sep);
  return account !== '..' && !isAbsolute(account ?? '') && folder === 'plans' && rest.length > 0;
}

const FILE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);

/**
 * What Jinion asks the user about in every mode, auto included, and whatever rules allow. A PreToolUse hook applies
 * it, which runs before Claude Code's own permission checks.
 */
const RULES: { reason: string; matches(tool: string, input: Input, cwd: string): boolean }[] = [
  {
    reason: 'Jinion asks before every commit.',
    matches: (tool, input) => tool === 'Bash' && commands(input.command).some((command) => /^git\s+(?:-[cC]\s+\S+\s+)*commit\b/.test(command)),
  },
  {
    reason: 'Jinion asks before changing files outside the project.',
    matches: (tool, input, cwd) => {
      if (!FILE_TOOLS.has(tool)) return false;
      const path = typeof input.file_path === 'string' ? input.file_path : typeof input.notebook_path === 'string' ? input.notebook_path : '';
      return path !== '' && !inside(path, cwd) && !isPlanFile(path);
    },
  },
];

export const GUARD_REASONS = new Set(RULES.map((rule) => rule.reason));

/** Why the call has to be asked about, if it does. */
export function guardReason(tool: string, input: Input, cwd: string) {
  return RULES.find((rule) => rule.matches(tool, input, cwd))?.reason;
}

/**
 * `git -C <folder>` running one of the read-only commands the allow rules let through without `-C`. In a folder that
 * holds several repositories the agent runs git like that, and a rule can't say it safely: `*` spans spaces, so
 * `git -C * status*` would also match `git -C api push origin status`.
 */
const READ_ONLY_GIT =
  /^git\s+-C\s+(?:"[^"]*"|'[^']*'|\S+)\s+(?:(?:status|diff|log|show)(?:\s|$)|branch(?:\s+(?:--show-current|--list|-[arv]+|-vv))*\s*$)/;

/** Whether a shell line only reads repositories with `git -C`, without redirecting output to a file. */
export function readsRepositories(tool: string, input: Input) {
  if (tool !== 'Bash' || typeof input.command !== 'string' || /[<>]/.test(input.command)) return false;
  const parts = commands(input.command);
  return parts.length > 0 && parts.every((command) => READ_ONLY_GIT.test(command));
}

/** The simple commands in a shell line, with leading `VAR=value` assignments and `sudo` dropped. */
function commands(line: unknown) {
  if (typeof line !== 'string') return [];
  return line
    .split(/&&|\|\||[;|\n]|\$\(|`/)
    .map((part) => part.trim().replace(/^(?:\w+=\S*\s+|sudo\s+)+/, ''))
    .filter(Boolean);
}

function inside(path: string, directory: string) {
  const from = relative(directory, resolve(directory, path));
  return from === '' || (!from.startsWith('..') && !isAbsolute(from));
}
