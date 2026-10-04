import { dayKey } from '../../lib/dates.js';
import { type DayUsage, emptyTokens, type UsageHistory } from '../usage.js';
import type { CodexConnection } from './connection.js';
import type { ThreadItem, Turn } from './protocol.js';

interface ListedThread {
  id: string;
  model: string | null;
  /** Set on a subagent's thread. */
  parentThreadId: string | null;
  /** Seconds since the epoch. */
  createdAt: number;
}

/** Seconds since the epoch. */
type DatedTurn = Turn & { startedAt: number | null; completedAt: number | null };

const TOOL_ITEMS = new Set<ThreadItem['type']>(['commandExecution', 'fileChange', 'mcpToolCall', 'dynamicToolCall', 'collabAgentToolCall', 'webSearch']);

/**
 * Codex's conversations on this machine, from its own history: each day's messages, tool calls and conversations. Codex
 * keeps no tokens per conversation, only the account's per day; a day's go to its models by how many turns each took.
 */
export async function codexHistory(connection: CodexConnection, names: Map<string, string>, progress?: (done: number, total: number) => void): Promise<UsageHistory> {
  const threads = await connection.all<ListedThread>('thread/list', { limit: 100 });
  const days = new Map<string, DayUsage>();
  const turnsByModel = new Map<string, Map<string, number>>();
  const conversations = new Map<string, Set<string>>();
  /** From its first turn's start to its last one's end, as Claude's run from first to last message. */
  const sessions: UsageHistory['sessions'] = [];

  const dayOf = (date: string) => {
    let day = days.get(date);

    if (!day) {
      day = { date, messages: 0, sessions: 0, toolCalls: 0, models: {} };
      days.set(date, day);
    }

    return day;
  };

  for (const [index, thread] of threads.entries()) {
    const model = names.get(thread.model ?? '') ?? thread.model ?? 'Codex';
    const turns = await connection.all<DatedTurn>('thread/turns/list', { threadId: thread.id, itemsView: 'full', sortDirection: 'asc' });
    const start = turns[0]?.startedAt;
    const end = Math.max(...turns.map((turn) => turn.completedAt ?? turn.startedAt ?? 0));

    if (!thread.parentThreadId && start) sessions.push({ id: thread.id, start: start * 1000, end: end * 1000 });

    for (const turn of turns) {
      const date = dayKey(new Date((turn.startedAt ?? thread.createdAt) * 1000));
      const day = dayOf(date);
      const models = turnsByModel.get(date) ?? new Map<string, number>();

      day.messages += turn.items.filter((item) => item.type === 'agentMessage').length;
      day.toolCalls += turn.items.filter((item) => TOOL_ITEMS.has(item.type)).length;
      models.set(model, (models.get(model) ?? 0) + 1);
      turnsByModel.set(date, models);
      if (!thread.parentThreadId) conversations.set(date, (conversations.get(date) ?? new Set()).add(thread.id));
    }

    progress?.(index + 1, threads.length);
  }

  const { dailyUsageBuckets } = await connection.request<{ dailyUsageBuckets: { startDate: string; tokens: number }[] | null }>('account/usage/read', {});

  // A day this machine has no turns on is another one's; its tokens stay out, as its messages do.
  for (const { startDate, tokens } of dailyUsageBuckets ?? []) {
    const models = turnsByModel.get(startDate);
    if (!models) continue;

    const turns = [...models.values()].reduce((sum, count) => sum + count, 0);

    for (const [model, count] of models) dayOf(startDate).models[model] = { ...emptyTokens(), summarized: Math.round((Number(tokens) * count) / turns) };
  }

  for (const [date, ids] of conversations) dayOf(date).sessions = ids.size;

  return { days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)), sessions };
}
