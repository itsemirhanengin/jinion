import { cleanTitle, TITLE_INSTRUCTIONS, titlePrompt } from '../titles.js';
import type { CodexConnection } from './connection.js';
import { type ThreadStarted, threadOf, type Turn } from './protocol.js';

/** Codex's fast and affordable model in the pinned version, as Haiku is Claude's. */
const MODEL = 'gpt-6-luna';

/** A title that takes longer isn't worth waiting for; the conversation is named again later. */
const GIVE_UP_MS = 60_000;

/** One turn in a thread of its own that isn't kept, told only to name the conversation. */
export async function codexTitle(connection: CodexConnection, { digest, current, cwd }: { digest: string; current?: string; cwd: string }) {
  const { thread } = await connection.request<ThreadStarted>('thread/start', {
    cwd,
    model: MODEL,
    ephemeral: true,
    baseInstructions: TITLE_INSTRUCTIONS,
    approvalPolicy: 'never',
    sandbox: 'read-only',
  });

  let reply = '';
  let stop = () => {};

  const ended = new Promise<string | undefined>((resolve) => {
    const timer = setTimeout(() => resolve(undefined), GIVE_UP_MS);

    const unsubscribe = connection.onNotification((notification) => {
      if (threadOf(notification) !== thread.id) return;

      if (notification.method === 'item/agentMessage/delta') reply += notification.params.delta;
      if (notification.method === 'turn/completed') resolve(notification.params.turn.status === 'completed' ? cleanTitle(reply) : undefined);
    });

    stop = () => {
      clearTimeout(timer);
      unsubscribe();
    };
  });

  try {
    await connection.request<{ turn: Turn }>('turn/start', {
      threadId: thread.id,
      input: [{ type: 'text', text: titlePrompt(digest, current), text_elements: [] }],
      effort: 'low',
      summary: 'none',
    });

    return await ended;
  } finally {
    stop();
    void connection.request('thread/unsubscribe', { threadId: thread.id }).catch(() => {});
  }
}
