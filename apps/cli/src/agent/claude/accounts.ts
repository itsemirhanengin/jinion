import { execFile, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { jinionHome } from '../../paths.js';
import type { AgentAccount, SignInOptions } from '../types.js';

/** Claude Code's own login in `~/.claude`, which every other account sits next to. */
export const DEFAULT_ACCOUNT = 'default';

const VALID_NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/i;

const PASTE_PROMPT = 'Paste code here if prompted';

const root = () => join(jinionHome(), 'accounts', 'claude');

const defaultConfigDir = () => process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');

/**
 * Each account is a Claude Code config directory of its own, which keeps its own login. Jinion never sees the
 * credentials; Claude Code signs in through its own flow and stores them.
 */
export const configDirOf = (name: string) => (name === DEFAULT_ACCOUNT ? undefined : join(root(), name));

/** The environment Claude Code runs with for `name`. */
export function accountEnv(name: string) {
  const dir = configDirOf(name);
  return dir ? { CLAUDE_CONFIG_DIR: dir } : {};
}

export function accountNames() {
  const named = existsSync(root())
    ? readdirSync(root(), { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && VALID_NAME.test(entry.name) && entry.name !== DEFAULT_ACCOUNT)
        .map((entry) => entry.name)
        .sort()
    : [];
  return [DEFAULT_ACCOUNT, ...named];
}

export function checkName(name: string) {
  return VALID_NAME.test(name) ? undefined : 'Use letters, digits, - or _, up to 32 characters.';
}

/** Claude Code says `team` in one place and `Claude Team` in another; both read as `Team`. */
export function planName(type: string | undefined) {
  const plan = type?.replace(/^claude\s+/i, '').trim();
  return plan ? plan[0]!.toUpperCase() + plan.slice(1).toLowerCase() : undefined;
}

/** Asks Claude Code who is signed in to `name`. */
export function accountStatus(name: string): Promise<AgentAccount> {
  return new Promise((resolve) => {
    execFile('claude', ['auth', 'status', '--json'], { env: { ...process.env, ...accountEnv(name) }, timeout: 15_000 }, (error, stdout) => {
      try {
        if (error) throw error;
        const status = JSON.parse(stdout) as { loggedIn?: boolean; email?: string; subscriptionType?: string; orgName?: string };
        resolve({
          name,
          signedIn: status.loggedIn === true,
          email: status.email,
          plan: planName(status.subscriptionType),
          organization: status.orgName,
        });
      } catch {
        resolve({ name, signedIn: false });
      }
    });
  });
}

/**
 * Runs `claude auth login` for `name`, which signs in in the browser, creating the account's directory when it is new.
 * Conversations are shared: the account's `projects` folder links to the default one, so a conversation can carry on
 * after a switch.
 */
export async function signIn(name: string, { signal, onLink, onPrompt }: SignInOptions) {
  const dir = configDirOf(name);
  if (dir) {
    mkdirSync(dir, { recursive: true });
    const projects = join(defaultConfigDir(), 'projects');
    mkdirSync(projects, { recursive: true });
    if (!existsSync(join(dir, 'projects'))) symlinkSync(projects, join(dir, 'projects'), 'dir');
  }

  await new Promise<void>((resolve, reject) => {
    const login = spawn('claude', ['auth', 'login', '--claudeai'], {
      env: { ...process.env, ...accountEnv(name) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let output = '';
    let linked = false;
    let asked = false;
    /** Where the output stood when the last code went in; a line after it is Claude Code's verdict. */
    let sentAt: number | undefined;
    const ask = (problem?: string) => onPrompt('Paste the code the browser shows', answer, problem);
    const answer = (text: string) => {
      sentAt = output.length;
      login.stdin.write(`${text.trim()}\n`);
    };
    const read = (chunk: Buffer) => {
      // The link comes wrapped in a terminal hyperlink; only its text is the URL.
      output += chunk.toString().replace(/\x1b\]8;;[^\x07]*\x07/g, '');
      const link = /https:\/\/[^\s\x07\x1b]+/.exec(output)?.[0];
      if (link && !linked) {
        linked = true;
        onLink(link);
      }
      // Claude Code asks for the code the browser shows once, then reads one per line and says when one is wrong.
      if (!asked && output.includes(PASTE_PROMPT)) {
        asked = true;
        ask();
      }
      const verdict = sentAt === undefined ? undefined : output.slice(sentAt).split('\n').find((line) => line.trim());
      if (verdict && output.slice(sentAt).includes('\n')) {
        sentAt = undefined;
        ask(verdict.trim());
      }
    };
    login.stdout.on('data', read);
    login.stderr.on('data', read);
    const cancel = () => login.kill();
    signal.addEventListener('abort', cancel, { once: true });
    login.on('error', reject);
    login.on('close', (code) => {
      signal.removeEventListener('abort', cancel);
      if (signal.aborted) reject(new Error('Sign-in cancelled.'));
      else if (code === 0) resolve();
      else reject(new Error(output.trim().split('\n').slice(-2).join('\n') || `claude auth login exited with ${code}.`));
    });
  });
  return accountStatus(name);
}
