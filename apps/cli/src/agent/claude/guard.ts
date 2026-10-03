import { homedir, tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
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
      if (tool === 'Bash') return typeof input.command === 'string' && writtenPaths(input.command, cwd).some((path) => outside(path, cwd));
      if (!FILE_TOOLS.has(tool)) return false;
      const path = typeof input.file_path === 'string' ? input.file_path : typeof input.notebook_path === 'string' ? input.notebook_path : '';
      return path !== '' && outside(resolve(cwd, path), cwd);
    },
  },
];

/** Where temporary files go: scratch space agents write to all the time, not the user's files. */
const SCRATCH = [tmpdir(), '/tmp', '/private/tmp', '/var/tmp', '/var/folders', '/private/var/folders'];
/** Devices a command writes to without changing a file. */
const STREAMS = /^\/dev\/(?:null|stdout|stderr|tty|fd\/\d+)$/;

/** A path outside the project that is the user's: not scratch space, a stream or Claude Code's own plans. */
function outside(path: string, cwd: string) {
  return !inside(path, cwd) && !isPlanFile(path) && !STREAMS.test(path) && !SCRATCH.some((folder) => inside(path, folder));
}

/**
 * The files a shell line writes to or changes, as absolute paths: redirections, `tee`, and commands such as `rm`, `mv`,
 * `cp`'s destination or `sed -i`, each from the folder a `cd` before it went to. A path with a variable other than
 * `$HOME` can't be told, and is left out.
 */
export function writtenPaths(line: string, cwd: string): string[] {
  const paths: string[] = [];
  let dir: string | undefined = cwd;
  for (const command of commands(line)) {
    const words = shellWords(command);
    const args: string[] = [];
    const targets: string[] = [];
    for (let index = 0; index < words.length; index++) {
      const word = words[index]!;
      if (/^(?:\d*|&)>>?$/.test(word)) {
        const target = words[++index];
        // `2>&1` points one stream at another.
        if (target && !target.startsWith('&')) targets.push(target);
      } else if (word === '<') index++;
      else args.push(word);
    }
    const [program = '', ...rest] = args;
    const operands = rest.filter((arg) => !arg.startsWith('-'));
    switch (basename(program)) {
      case 'cd':
      case 'pushd': {
        const to = expand(operands[0] ?? '~');
        dir = to === undefined || dir === undefined ? undefined : resolve(dir, to);
        continue;
      }
      case 'tee':
      case 'rm':
      case 'rmdir':
      case 'unlink':
      case 'touch':
      case 'mkdir':
      case 'truncate':
      case 'shred':
      case 'mv':
        targets.push(...operands);
        break;
      case 'chmod':
      case 'chown':
      case 'chgrp':
        targets.push(...operands.slice(1));
        break;
      case 'cp':
      case 'install':
      case 'ln':
        if (operands.length >= 2) targets.push(operands.at(-1)!);
        break;
      case 'sed':
        if (rest.some((arg) => /^-[^-]*i/.test(arg) || arg.startsWith('--in-place'))) {
          // The script is the first operand, unless it came with -e.
          targets.push(...(rest.includes('-e') ? operands : operands.slice(1)));
        }
        break;
      case 'dd':
        targets.push(...rest.filter((arg) => arg.startsWith('of=')).map((arg) => arg.slice(3)));
        break;
    }
    if (dir === undefined) continue;
    for (const target of targets) {
      const path = expand(target);
      if (path !== undefined) paths.push(resolve(dir, path));
    }
  }
  return paths;
}

/** `~` and `$HOME` as the home folder; `undefined` for other variables, which only the shell knows. */
function expand(path: string) {
  const home = path.replace(/^~(?=\/|$)/, homedir()).replace(/^\$(?:HOME\b|\{HOME\})/, homedir());
  return home.includes('$') ? undefined : home;
}

/** A command's words as the shell splits them, quotes taken off, with redirections such as `>`, `2>>` or `&>` apart. */
function shellWords(command: string) {
  const words: string[] = [];
  let word = '';
  let started = false;
  let quote: string | undefined;
  const flush = () => {
    if (started) words.push(word);
    word = '';
    started = false;
  };
  for (let index = 0; index < command.length; index++) {
    const char = command[index]!;
    if (quote) {
      if (char === quote) quote = undefined;
      else if (char === '\\' && quote === '"') word += command[++index] ?? '';
      else word += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      started = true;
    } else if (char === '\\') {
      word += command[++index] ?? '';
      started = true;
    } else if (/\s/.test(char)) flush();
    else if (char === '>') {
      // A stream's number or `&` right before belongs to the operator.
      const prefix = started && /^(?:\d+|&)$/.test(word) ? word : '';
      if (prefix) {
        word = '';
        started = false;
      } else flush();
      let operator = `${prefix}>`;
      if (command[index + 1] === '>') operator += command[++index];
      if (command[index + 1] === '|') index++;
      words.push(operator);
    } else if (char === '<') {
      flush();
      words.push('<');
    } else {
      word += char;
      started = true;
    }
  }
  flush();
  return words;
}

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
