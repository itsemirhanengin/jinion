import type { Status } from '@jinion/tui';
import type { AgentEvent } from '../agent/events.js';
import type { ToolRun } from '../agent/tools.js';
import { nextId, noticeEntry, type Entry, type ToolCallEntry } from './entries.js';
import { addEntries, updateTool, type Session } from './session.js';

export function applyEvent(session: Session, event: AgentEvent): Session {
  switch (event.type) {
    case 'thinking':
    case 'text':
      return streamed(session, event.type, event.delta);
    case 'tool-start':
      return toolStart(session, event);
    case 'tool-output':
      return updateTool(session, event.id, (entry) => ({ ...entry, output: [...entry.output, ...event.lines] }));
    case 'tool-end':
      return toolEnd(session, event);
    case 'usage':
      return { ...session, usage: event.usage };
    case 'session':
      return { ...session, agentSession: event.id };
    case 'sent': {
      // The prompt that started the turn is the newest message the agent hasn't named yet.
      const index = session.entries.findLastIndex((entry) => entry.kind === 'user' && !entry.promptId);
      if (index === -1) return session;
      const entries = session.entries.map((entry, at) => (at === index ? { ...entry, promptId: event.id } : entry));
      return { ...session, entries };
    }
    case 'compaction': {
      if (event.state === 'running') return { ...session, compacting: true };
      const done = { ...session, compacting: undefined };
      if (event.state === 'failed') return addEntries(done, noticeEntry(`Couldn't compact the conversation: ${event.error}`, 'error'));
      const { trigger, before, after, summary } = event;
      return addEntries(done, { id: nextId(), kind: 'compaction', trigger, before, after, summary });
    }
    case 'task-end':
      return addEntries(session, { id: nextId(), kind: 'task', task: event.task, summary: event.summary });
    case 'limits':
    case 'mode':
    case 'commands':
    case 'tasks':
    case 'turn-start':
      // Kept by the app: they belong to the account or the agent's process and outlive the conversation on screen.
      return session;
  }
}

function streamed(session: Session, kind: 'thinking' | 'text', delta: string): Session {
  const last = session.entries.at(-1);
  if (last?.kind === kind) {
    return { ...session, entries: [...session.entries.slice(0, -1), { ...last, text: last.text + delta }] };
  }
  const text = delta.trimStart();
  const entry: Entry = kind === 'thinking' ? { id: nextId(), kind, text, startedAt: Date.now() } : { id: nextId(), kind, text };
  return addEntries(session, entry);
}

function toolStart(session: Session, event: Extract<AgentEvent, { type: 'tool-start' }>): Session {
  if (event.parent) {
    const child: ToolCallEntry = { id: event.id, run: event.call, status: 'running', startedAt: Date.now() };
    return updateTool(session, event.parent, (entry) => ({ ...entry, children: [...(entry.children ?? []), child] }));
  }
  const entry: Entry = { id: event.id, kind: 'tool', run: event.call, status: 'running', output: [], startedAt: Date.now() };
  if (event.call.name !== 'todo') return addEntries(session, entry);
  // Consecutive todo updates replace each other instead of stacking up.
  const last = session.entries.at(-1);
  const kept = last?.kind === 'tool' && last.run.name === 'todo' ? session.entries.slice(0, -1) : session.entries;
  return { ...session, entries: [...kept, entry], todos: event.call.input.groups };
}

function toolEnd(session: Session, event: Extract<AgentEvent, { type: 'tool-end' }>): Session {
  const end = <T extends { run: ToolRun; status: Status }>(call: T): T => ({
    ...call,
    run: { ...call.run, result: event.result } as ToolRun,
    status: event.ok ? 'done' : 'error',
    endedAt: Date.now(),
  });
  const { parent } = event;
  if (!parent) return updateTool(session, event.id, end);
  return updateTool(session, parent, (entry) => ({
    ...entry,
    children: entry.children?.map((child) => (child.id === event.id ? end(child) : child)),
  }));
}
