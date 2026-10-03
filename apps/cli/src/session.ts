import type { NoticeTone, Status, TodoGroup } from '@jinion/tui';
import type { AgentEvent, AgentResume, ToolRun, Usage } from './agent/types.js';

export type Entry =
  | { id: string; kind: 'banner' }
  /**
   * `prompt` is what the agent got, when pasted text made it longer than what is shown. `steered` messages were sent
   * into a turn in progress. `promptId` is what the agent calls the message, for going back to before it.
   */
  | { id: string; kind: 'user'; text: string; prompt?: string; steered?: boolean; promptId?: string }
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
  /** The agent's own id for this conversation, used to continue it after `/resume`. */
  agentSession?: string;
}

/** What a session store keeps of a conversation. */
export type SavedSession = Omit<Session, 'busySince' | 'title'> & { title: string; updatedAt: number };

export type Action =
  | { type: 'submit'; text: string; prompt?: string }
  /** A message added to the turn in progress; `id` is what the agent calls it. */
  | { type: 'steer'; text: string; prompt?: string; id?: string }
  /** The conversation went back to before this user entry, which leaves it with everything after it. */
  | { type: 'rewind'; entry: string }
  | { type: 'event'; event: AgentEvent }
  | { type: 'finish'; outcome: 'done' | 'interrupted' | 'failed'; message?: string }
  | { type: 'notice'; text: string; tone?: NoticeTone }
  | { type: 'clear' }
  | { type: 'load'; session: SavedSession };

let sequence = 0;
/** Saved sessions come back in later runs, so ids carry a per-run prefix to stay unique next to their entries. */
const run = Math.random().toString(36).slice(2, 8);
export const nextId = () => `${run}${++sequence}`;

export function createSession(contextWindow: number): Session {
  return {
    id: `session_${Date.now().toString(36)}_${nextId()}`,
    createdAt: Date.now(),
    entries: [{ id: nextId(), kind: 'banner' }],
    todos: [],
    usage: { contextTokens: 0, contextWindow, cost: 0 },
  };
}

function titleOf(text: string) {
  const line = text.trim().split('\n')[0] ?? '';
  return line.length > 60 ? `${line.slice(0, 59)}…` : line;
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

export function fromSaved(saved: SavedSession): Session {
  const { updatedAt: _, ...session } = saved;
  return session;
}

/** What the agent needs to continue a saved conversation, if it can. */
export const resumeOf = (saved: SavedSession): AgentResume | undefined =>
  saved.agentSession ? { sessionId: saved.agentSession, cost: saved.usage.cost } : undefined;

const notice = (text: string, tone: NoticeTone): Entry => ({ id: nextId(), kind: 'notice', text, tone });

export function reduce(session: Session, action: Action): Session {
  switch (action.type) {
    case 'submit':
      return {
        ...session,
        entries: [...session.entries, { id: nextId(), kind: 'user', text: action.text, prompt: action.prompt }],
        // A first title from what the user typed, until the agent names the conversation.
        title: session.title ?? titleOf(action.text),
        busySince: Date.now(),
      };
    case 'steer':
      return {
        ...session,
        entries: [
          ...session.entries,
          { id: nextId(), kind: 'user', text: action.text, prompt: action.prompt, steered: true, promptId: action.id },
        ],
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
      return createSession(session.usage.contextWindow);
    case 'load':
      return fromSaved(action.session);
    case 'rewind': {
      const index = session.entries.findIndex((entry) => entry.id === action.entry);
      if (index === -1) return session;
      const entries = session.entries.slice(0, index);
      // The task list goes back to what the last update before that message showed.
      const todos = entries.findLast((entry) => entry.kind === 'tool' && entry.run.name === 'todo');
      return { ...session, entries, todos: todos?.kind === 'tool' && todos.run.name === 'todo' ? todos.run.input.groups : [] };
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
    case 'session':
      return { ...session, agentSession: event.id };
    case 'sent': {
      // The prompt that started the turn is the newest message the agent hasn't named yet.
      const index = session.entries.findLastIndex((entry) => entry.kind === 'user' && !entry.promptId);
      if (index === -1) return session;
      const entries = session.entries.map((entry, at) => (at === index ? { ...entry, promptId: event.id } : entry));
      return { ...session, entries };
    }
    case 'limits':
    case 'mode':
    case 'commands':
      // Kept by the app: they belong to the account or the agent and outlive the conversation.
      return session;
  }
}

function updateTool(session: Session, id: string, update: (entry: ToolEntry) => Entry): Session {
  return {
    ...session,
    entries: session.entries.map((entry) => (entry.kind === 'tool' && entry.id === id ? update(entry) : entry)),
  };
}
