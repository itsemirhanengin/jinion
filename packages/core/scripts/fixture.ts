// `pnpm --filter @jinion/core fixture <log> <name>` writes `tests/agent/claude/fixtures/<name>.jsonl` from a `--debug` log.
// Fixtures are committed, so paths and names are replaced and the init message drops what is installed on this machine.
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import { join, resolve } from 'node:path';
import type { DebugRecord } from '../src/lib/debug.js';

const INIT_FIELDS = ['type', 'subtype', 'session_id', 'uuid', 'model', 'permissionMode', 'cwd', 'claude_code_version'];

/** The commands installed on this machine, and progress counts while the model thinks. */
const DROPPED = new Set(['commands_changed', 'thinking_tokens']);

// biome-ignore lint/suspicious/noExplicitAny: the script reaches into SDK messages of every shape by hand.
type Message = Record<string, any>;

const DELTA_TEXT: Record<string, string> = { text_delta: 'text', thinking_delta: 'thinking', input_json_delta: 'partial_json' };

const [log, name] = process.argv.slice(2);

if (!log || !name) {
  console.error('Usage: fixture <debug log> <fixture name>');
  process.exit(1);
}

// Package scripts run in the package folder; INIT_CWD is where the user typed the command.
const records = readFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), log), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line) as DebugRecord);

const cwd = (records.find((record) => record.kind === 'start')?.data as { cwd?: string } | undefined)?.cwd;

const replacements: [string, string][] = [
  ...(cwd ? [cwd, realpathSync(cwd)].map((path): [string, string] => [path, '/project']) : []),
  [homedir(), '/home/user'],
  [userInfo().username, 'user'],
];

/** Claude Code's temporary folder for the project, where background tasks write their output. */
const CLAUDE_TEMP = /(?:\/private)?\/tmp\/claude-\d+\/[^/"\\]+\//g;

const clean = (text: string) =>
  replacements.reduce((current, [from, to]) => current.replaceAll(from, to), text).replace(CLAUDE_TEMP, '/tmp/claude/project/');

const messages = records
  .filter((record) => record.kind === 'message')
  .map((record) => record.data as Message)
  .filter((message) => !(message.type === 'system' && DROPPED.has(message.subtype)))
  .map((message) => {
    if (message.type !== 'system' || message.subtype !== 'init') return message;

    return Object.fromEntries(INIT_FIELDS.filter((field) => field in message).map((field) => [field, message[field]]));
  });

const lines = mergeDeltas(messages).map((message) => clean(JSON.stringify(message)));

const path = join(import.meta.dirname, '..', 'tests', 'agent', 'claude', 'fixtures', `${name}.jsonl`);

writeFileSync(path, `${lines.join('\n')}\n`);
console.log(`Wrote ${lines.length} messages to ${path}`);

function mergeDeltas(messages: Message[]) {
  const merged: Message[] = [];

  for (const message of messages) {
    const last = merged.at(-1);
    const delta = message.type === 'stream_event' && message.event.type === 'content_block_delta' ? message.event.delta : undefined;
    const field = delta && DELTA_TEXT[delta.type];
    const previous = last?.type === 'stream_event' && last.event.type === 'content_block_delta' ? last.event : undefined;

    if (field && previous && previous.index === message.event.index && previous.delta.type === delta.type && last!.parent_tool_use_id === message.parent_tool_use_id) {
      previous.delta[field] += delta[field];
      continue;
    }

    merged.push(message);
  }

  return merged;
}
