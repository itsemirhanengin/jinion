import type { NoticeTone, Status, TodoGroup } from '@jinion/tui';
import type { AgentEvent, ToolRun, Usage } from './agent/types.js';

export type Entry =
  | { id: string; kind: 'banner' }
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'thinking'; text: string }
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'notice'; text: string; tone: NoticeTone }
  | { id: string; kind: 'tool'; run: ToolRun; status: Status; output: string[]; startedAt: number; endedAt?: number };

type ToolEntry = Extract<Entry, { kind: 'tool' }>;

export interface Session {
  id: string;
  createdAt: number;
  entries: Entry[];
  todos: TodoGroup[];
  usage: Usage;
  title?: string;
  busySince?: number;
}

/** What a session store keeps of a conversation. */
export type SavedSession = Omit<Session, 'busySince' | 'title'> & { title: string; updatedAt: number };

export type Action =
  | { type: 'submit'; text: string }
  | { type: 'event'; event: AgentEvent }
  | { type: 'finish'; outcome: 'done' | 'interrupted' | 'failed'; message?: string }
  | { type: 'notice'; text: string; tone?: NoticeTone }
  | { type: 'clear' }
  | { type: 'load'; session: SavedSession };

let sequence = 0;
export const nextId = () => String(++sequence);

export function createSession(contextWindow: number): Session {
  return {
    id: `session_${Date.now().toString(36)}_${nextId()}`,
    createdAt: Date.now(),
    entries: [{ id: nextId(), kind: 'banner' }],
    todos: [],
    usage: { contextTokens: 0, contextWindow, cost: 0 },
  };
}

export const firstPrompt = (session: Pick<Session, 'entries'>) =>
  session.entries.find((entry) => entry.kind === 'user')?.text;

/** `undefined` when nothing was asked yet, so empty sessions are not kept. */
export function toSaved(session: Session): SavedSession | undefined {
  const prompt = firstPrompt(session);
  if (prompt === undefined) return undefined;
  const { busySince: _, title, ...rest } = session;
  return { ...rest, title: title ?? prompt, updatedAt: Date.now() };
}

const notice = (text: string, tone: NoticeTone): Entry => ({ id: nextId(), kind: 'notice', text, tone });

export function reduce(session: Session, action: Action): Session {
  switch (action.type) {
    case 'submit':
      return {
        ...session,
        entries: [...session.entries, { id: nextId(), kind: 'user', text: action.text }],
        busySince: Date.now(),
      };
    case 'event':
      return apply(session, action.event);
    case 'finish': {
      const entries = session.entries.map((entry) =>
        entry.kind === 'tool' && entry.status === 'running'
          ? { ...entry, status: 'cancelled' as const, endedAt: Date.now() }
          : entry,
      );
      if (action.outcome === 'interrupted') entries.push(notice('Interrupted. Tell jinion what to do instead.', 'warning'));
      if (action.outcome === 'failed') entries.push(notice(action.message ?? 'Something went wrong.', 'error'));
      return { ...session, entries, busySince: undefined };
    }
    case 'notice':
      return { ...session, entries: [...session.entries, notice(action.text, action.tone ?? 'muted')] };
    case 'clear':
      return { ...createSession(session.usage.contextWindow), usage: session.usage };
    case 'load': {
      const { updatedAt: _, ...saved } = action.session;
      return saved;
    }
  }
}

function apply(session: Session, event: AgentEvent): Session {
  switch (event.type) {
    case 'thinking':
    case 'text': {
      const last = session.entries.at(-1);
      const entries =
        last?.kind === event.type
          ? [...session.entries.slice(0, -1), { ...last, text: last.text + event.delta }]
          : [...session.entries, { id: nextId(), kind: event.type, text: event.delta.trimStart() }];
      return { ...session, entries };
    }
    case 'tool-start': {
      const entry: Entry = {
        id: event.id,
        kind: 'tool',
        run: event.call,
        status: 'running',
        output: [],
        startedAt: Date.now(),
      };
      if (event.call.name !== 'todo') return { ...session, entries: [...session.entries, entry] };
      // Consecutive todo updates replace each other instead of stacking up.
      const last = session.entries.at(-1);
      const kept = last?.kind === 'tool' && last.run.name === 'todo' ? session.entries.slice(0, -1) : session.entries;
      return { ...session, entries: [...kept, entry], todos: event.call.input.groups };
    }
    case 'tool-output':
      return updateTool(session, event.id, (entry) => ({ ...entry, output: [...entry.output, ...event.lines] }));
    case 'tool-end':
      return updateTool(session, event.id, (entry) => ({
        ...entry,
        run: { ...entry.run, result: event.result } as ToolRun,
        status: event.ok ? 'done' : 'error',
        endedAt: Date.now(),
      }));
    case 'usage':
      return { ...session, usage: event.usage };
    case 'title':
      return { ...session, title: event.title };
  }
}

function updateTool(session: Session, id: string, update: (entry: ToolEntry) => Entry): Session {
  return {
    ...session,
    entries: session.entries.map((entry) => (entry.kind === 'tool' && entry.id === id ? update(entry) : entry)),
  };
}
