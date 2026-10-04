import type { TodoGroup } from '@jinion/tui/chat';
import type { BackgroundTask } from '@jinion/core/agent/tasks';
import type { ToolRun } from '@jinion/core/agent/tools';
import type { Usage } from '@jinion/core/agent/usage';
import type { Dialog } from '@jinion/core/conversation/dialogs';
import type { SessionState } from '@jinion/core/conversation/session';
import { clip } from '@jinion/core/lib/text';

const CONTEXT_WARNING = 0.2;
const COMMAND_LENGTH = 60;

export const hasWorkLeft = (todos: TodoGroup[]) => todos.some((group) => group.items.some((item) => item.status !== 'done'));

/** As in Claude Code, the share of context left until auto-compaction, once it draws near. */
export function contextWarning({ contextTokens, compactAt }: Usage) {
  if (!compactAt) return undefined;

  const left = 1 - contextTokens / compactAt;

  return left <= CONTEXT_WARNING ? left : undefined;
}

export function activity(session: SessionState, dialog: Dialog['id'] | undefined, tasks: BackgroundTask[]) {
  if (dialog === 'permission' || dialog === 'plan') return 'Waiting for your approval';
  if (session.compacting) return 'Compacting the conversation';

  const last = session.entries.at(-1);
  if (last?.kind === 'thinking') return 'Thinking';
  if (last?.kind === 'text') return 'Writing';
  if (last?.kind === 'task') return 'Looking at the background task that ended';

  if (last?.kind === 'tool' && last.status === 'running') {
    if (last.run.name === 'ask') return 'Waiting for your answer';

    const hint = tasks.some((task) => task.foreground && task.status === 'running') ? ' · ctrl+b to run it in the background' : '';
    if (last.run.name === 'agent') return `A subagent is on it: ${last.run.input.description}${hint}`;

    return `Running ${runningName(last.run)}${hint}`;
  }

  return 'Working';
}

function runningName(run: ToolRun) {
  switch (run.name) {
    case 'bash':
      return clip(run.input.command, COMMAND_LENGTH);
    case 'other':
      return run.input.title;
    case 'mcp':
      return `${run.input.server}:${run.input.tool}`;
    case 'fetch':
      return `fetch: ${run.input.url}`;
    case 'search':
      return `web search: ${run.input.query}`;
    default:
      return run.name;
  }
}
