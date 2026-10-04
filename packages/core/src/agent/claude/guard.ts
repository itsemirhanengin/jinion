import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import type { Input } from './input.js';
import { inside, isPlanFile } from './paths.js';
import { commands, writtenPaths } from './shell.js';

const FILE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);
const SCRATCH = [tmpdir(), '/tmp', '/private/tmp', '/var/tmp', '/var/folders', '/private/var/folders'];
const STREAMS = /^\/dev\/(?:null|stdout|stderr|tty|fd\/\d+)$/;

interface Rule {
  reason: string;
  matches(tool: string, input: Input, cwd: string): boolean;
}

const COMMITS: Rule = {
  reason: 'Jinion asks before every commit.',
  matches: (tool, input) => tool === 'Bash' && commands(input.command).some((command) => /^git\s+(?:-[cC]\s+\S+\s+)*commit\b/.test(command)),
};

/** Asked in every mode, auto included, whatever rules allow: a PreToolUse hook runs these before Claude Code's own checks. */
const RULES: Rule[] = [
  COMMITS,
  {
    reason: 'Jinion asks before changing files outside the project.',
    matches: (tool, input, cwd) => {
      if (tool === 'Bash') return typeof input.command === 'string' && writtenPaths(input.command, cwd).some((path) => outside(path, cwd));
      if (!FILE_TOOLS.has(tool)) return false;

      const path = typeof input.file_path === 'string' ? input.file_path : typeof input.notebook_path === 'string' ? input.notebook_path : '';

      return path !== '' && outside(resolve(cwd, path), cwd);
    },
  },
];

export const GUARD_REASONS = new Set(RULES.map((rule) => rule.reason));

export function guardReason(tool: string, input: Input, cwd: string, asksBeforeCommits = true) {
  return RULES.find((rule) => (asksBeforeCommits || rule !== COMMITS) && rule.matches(tool, input, cwd))?.reason;
}

/** A rule can't allow these safely: `*` spans spaces, so `git -C * status*` would also match `git -C api push origin status`. */
const READ_ONLY_GIT =
  /^git\s+-C\s+(?:"[^"]*"|'[^']*'|\S+)\s+(?:(?:status|diff|log|show)(?:\s|$)|branch(?:\s+(?:--show-current|--list|-[arv]+|-vv))*\s*$)/;

export function readsRepositories(tool: string, input: Input) {
  if (tool !== 'Bash' || typeof input.command !== 'string' || /[<>]/.test(input.command)) return false;

  const parts = commands(input.command);

  return parts.length > 0 && parts.every((command) => READ_ONLY_GIT.test(command));
}

function outside(path: string, cwd: string) {
  return !inside(path, cwd) && !isPlanFile(path) && !STREAMS.test(path) && !SCRATCH.some((folder) => inside(path, folder));
}
