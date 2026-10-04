import { query } from '@anthropic-ai/claude-agent-sdk';
import { cleanTitle, TITLE_INSTRUCTIONS, titlePrompt } from '../titles.js';
import { accountEnv } from './accounts.js';

const MODEL = 'haiku';

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
    prompt: titlePrompt(digest, current),
    options: {
      cwd,
      model: MODEL,
      systemPrompt: TITLE_INSTRUCTIONS,
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
