// `pnpm --filter @jinion/core codex-fixture <log> <name>` writes `tests/agent/codex/fixtures/<name>.jsonl` from a `--debug`
// log of a Codex conversation: what the app-server sent, notifications and its requests, without the answers to Jinion's
// own requests. Fixtures are committed, so paths, names and the email are replaced.
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join, resolve } from 'node:path';
import type { DebugRecord } from '../src/lib/debug.js';

/** What says something about this machine or account rather than the conversation. */
const DROPPED = /^(hook\/|mcpServer\/|remoteControl\/|rawResponse|configWarning|warning|thread\/started|thread\/settings\/updated|app\/|skills\/changed|account\/updated)/;

// biome-ignore lint/suspicious/noExplicitAny: the script reads messages of every shape.
type Message = Record<string, any>;

const [log, name] = process.argv.slice(2);

if (!log || !name) {
  console.error('Usage: codex-fixture <debug log> <fixture name>');
  process.exit(1);
}

// Package scripts run in the package folder; INIT_CWD is where the user typed the command.
const records = readFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), log), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line) as DebugRecord);

const sent = records.filter((record) => record.kind === 'prompt').map((record) => record.data as Message);
const cwd = sent.find((message) => message.method === 'thread/start' || message.method === 'thread/resume')?.params?.cwd as string | undefined;
const emails = new Set(JSON.stringify(records).match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []);

const replacements: [string, string][] = [
  ...(cwd ? [cwd, realpathSync(cwd)].map((path): [string, string] => [path, '/project']) : []),
  [homedir(), '/home/user'],
  [userInfo().username, 'user'],
  ...[...emails].map((email): [string, string] => [email, 'user@example.com']),
];

const clean = (text: string) => replacements.reduce((current, [from, to]) => current.replaceAll(from, to), text);

const lines = records
  .filter((record) => record.kind === 'message')
  .map((record) => record.data as Message)
  .filter((message) => message.method !== undefined && !DROPPED.test(message.method))
  .map(({ emittedAtMs: _, ...message }) => clean(JSON.stringify(message)));

const path = join(import.meta.dirname, '..', 'tests', 'agent', 'codex', 'fixtures', `${name}.jsonl`);

writeFileSync(path, `${lines.join('\n')}\n`);
console.log(`Wrote ${lines.length} messages to ${path}`);
