import { query } from '@anthropic-ai/claude-agent-sdk';
import { accountEnv } from './accounts.js';

/** Claude Code's small, fast model, which titles its own sessions too. */
const MODEL = 'haiku';

const INSTRUCTIONS = `You name conversations between a developer and a coding agent, so the developer can find them again in a list of many.

Reply with the title only, never an explanation, also when there is little to name: a noun phrase of 3 to 6 words, in the language the developer writes in (also when their messages are short), sentence case, no quotes, no trailing period. Write names of files, functions and commands exactly as they are, e.g. math.ts.
Name what the conversation as a whole works on: what is being built, fixed, investigated or decided, and where; not just its latest message. A greeting or small talk is not work; when there is nothing else yet, name what the developer asked about, or the greeting itself.
When a current title is given and it still fits the conversation as a whole, reply with it unchanged. It no longer fits when it names a greeting or small talk and there is work now, or names only a part of work that has grown.`;

/**
 * A title from a one-off request to the small model: no tools, no thinking, nothing saved, under the account in use. It
 * runs beside the conversation's own process, which it doesn't touch.
 */
export async function claudeTitle({
  digest,
  current,
  cwd,
  account,
  spawn = query,
}: {
  digest: string;
  current?: string;
  cwd: string;
  account: string;
  spawn?: typeof query;
}) {
  const run = spawn({
    prompt: [current && `Current title: ${current}`, `The conversation:\n${digest}`].filter(Boolean).join('\n\n'),
    options: {
      cwd,
      model: MODEL,
      systemPrompt: INSTRUCTIONS,
      tools: [],
      maxTurns: 1,
      thinking: { type: 'disabled' },
      persistSession: false,
      settingSources: [],
      mcpServers: {},
      strictMcpConfig: true,
      env: { ...process.env, ...accountEnv(account) },
    },
  });
  try {
    for await (const message of run) {
      if (message.type === 'result') return message.subtype === 'success' ? cleanTitle(message.result) : undefined;
    }
    return undefined;
  } finally {
    run.close();
  }
}

/** Longer than a title: the model explained itself instead. */
const MAX_WORDS = 10;

/**
 * The model's reply as a title: its first line, without quotes, a `Title:` label or a closing period. A reply too long
 * for a title has none.
 */
export function cleanTitle(reply: string) {
  const line = reply.trim().split('\n')[0]!.replace(/^title:\s*/i, '').replace(/^["'“”‘’`*]+|["'“”‘’`*.]+$/g, '').trim();
  if (!line || line.split(/\s+/).length > MAX_WORDS) return undefined;
  return line.length > 80 ? `${line.slice(0, 79)}…` : line;
}
