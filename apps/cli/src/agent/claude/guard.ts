import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

type Input = Record<string, unknown>;

/** Claude Code writes plans here in plan mode; that's its own bookkeeping, not a change to the user's files. */
const PLANS = join(homedir(), '.claude', 'plans');

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
      return path !== '' && !inside(path, cwd) && !inside(path, PLANS);
    },
  },
];

export const GUARD_REASONS = new Set(RULES.map((rule) => rule.reason));

/** Why the call has to be asked about, if it does. */
export function guardReason(tool: string, input: Input, cwd: string) {
  return RULES.find((rule) => rule.matches(tool, input, cwd))?.reason;
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
