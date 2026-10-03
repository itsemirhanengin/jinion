import { execFile, spawn } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import type { AgentAccount, SignInOptions } from '../accounts.js';
import { accountEnv, configDirOf, DEFAULT_ACCOUNT, makeConfigDir, planName } from './accounts.js';
import { claudeBinary } from './paths.js';

const PASTE_PROMPT = 'Paste code here if prompted';

/** Logging out clears the Keychain entry or `.credentials.json`; conversations stay, as `projects` is only a link. */
export async function removeAccount(name: string) {
  const dir = configDirOf(name);
  if (!dir) throw new Error("it is Claude Code's own login, which stays");
  if (!existsSync(dir)) throw new Error(`there is no account called ${name}`);

  await runClaude(['auth', 'logout'], name).catch(() => {});

  // A folder deleted while still signed in would leave its login behind in the Keychain.
  if ((await accountStatus(name)).signedIn) throw new Error("Claude Code couldn't sign it out, so it stays");

  rmSync(dir, { recursive: true, force: true });
}

export async function accountStatus(name: string): Promise<AgentAccount> {
  const own = name === DEFAULT_ACCOUNT;

  try {
    const status = JSON.parse(await runClaude(['auth', 'status', '--json'], name)) as {
      loggedIn?: boolean;
      email?: string;
      subscriptionType?: string;
      orgName?: string;
    };

    return {
      name,
      own,
      signedIn: status.loggedIn === true,
      email: status.email,
      plan: planName(status.subscriptionType),
      organization: status.orgName,
    };
  } catch {
    return { name, own, signedIn: false };
  }
}

export async function signIn(name: string, { signal, onLink, onPrompt }: SignInOptions) {
  makeConfigDir(name);

  await new Promise<void>((resolve, reject) => {
    const login = spawn(claudeBinary(), ['auth', 'login', '--claudeai'], {
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
    login.on('error', reject);

    const cancel = () => login.kill();

    signal.addEventListener('abort', cancel, { once: true });

    login.on('close', (code) => {
      signal.removeEventListener('abort', cancel);

      if (signal.aborted) reject(new Error('Sign-in cancelled.'));
      else if (code === 0) resolve();
      else reject(new Error(output.trim().split('\n').slice(-2).join('\n') || `claude auth login exited with ${code}.`));
    });
  });

  return accountStatus(name);
}

function runClaude(args: string[], account: string) {
  return new Promise<string>((resolve, reject) =>
    execFile(claudeBinary(), args, { env: { ...process.env, ...accountEnv(account) }, timeout: 15_000 }, (error, stdout) =>
      error ? reject(error) : resolve(stdout),
    ),
  );
}
