import type { TodoGroup } from '../agent/todos.js';
import type { AgentResume } from '../agent/agent.js';
import type { Usage } from '../agent/usage.js';
import type { Worktree } from '../git/worktrees.js';
import type { Entry, NewEntry, ToolEntry } from './entries.js';

export interface SessionState {
  id: string;
  createdAt: number;
  entries: Entry[];
  todos: TodoGroup[];
  usage: Usage;
  title?: string;
  /** `turns` is how many prompts there were when it was titled; a title the user chose is kept. */
  titled?: { by: 'agent' | 'user'; turns: number; at: number };
  busySince?: number;
  /** Where the running turn begins in `entries`; what follows stays open until it ends. */
  turnFrom?: number;
  compacting?: boolean;
  agentSession?: string;
  /** Where the conversation works, when it has a worktree of its own. */
  worktree?: Worktree;
  /** The last id the conversation gave an entry of its own; saved, so a resumed one goes on from it. */
  lastEntry?: number;
}

export type SavedSession = Omit<SessionState, 'busySince' | 'turnFrom' | 'compacting' | 'title'> & { title: string; updatedAt: number };

export function createSessionState(contextWindow: number): SessionState {
  return {
    id: `session_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: Date.now(),
    entries: [{ id: 'banner', kind: 'banner' }],
    todos: [],
    usage: { contextTokens: 0, contextWindow, cost: 0 },
    lastEntry: 0,
  };
}

export const firstPrompt = (session: Pick<SessionState, 'entries'>) =>
  session.entries.find((entry) => entry.kind === 'user')?.text;

/** `undefined` when nothing was asked yet, so empty sessions are not kept. */
export function toSaved(session: SessionState): SavedSession | undefined {
  const prompt = firstPrompt(session);
  if (prompt === undefined) return undefined;

  const { busySince: _, turnFrom: __, compacting: ___, title, ...rest } = session;

  return { ...rest, title: title ?? prompt, updatedAt: Date.now() };
}

export function fromSaved(saved: SavedSession): SessionState {
  const { updatedAt: _, ...session } = saved;

  return session;
}

export const resumeOf = (saved: SavedSession): AgentResume | undefined =>
  saved.agentSession ? { sessionId: saved.agentSession, cost: saved.usage.cost } : undefined;

/** A command's output stays open until its turn ends. */
export const inRunningTurn = (session: Pick<SessionState, 'busySince' | 'turnFrom'>, index: number) =>
  session.busySince !== undefined && index >= (session.turnFrom ?? 0);

/** For entries whose id comes from outside, such as a tool call the agent named. */
export const addEntries = (session: SessionState, ...entries: Entry[]): SessionState => ({
  ...session,
  entries: [...session.entries, ...entries],
});

/** Ids come from the conversation's own count, so replaying its actions anywhere gives the same entries. */
export function addNewEntries(session: SessionState, ...entries: NewEntry[]): SessionState {
  let last = session.lastEntry ?? 0;
  const made = entries.map((entry) => ({ ...entry, id: `e${++last}` }) as Entry);

  return { ...session, entries: [...session.entries, ...made], lastEntry: last };
}

export function updateTool(session: SessionState, id: string, update: (entry: ToolEntry) => Entry): SessionState {
  return {
    ...session,
    entries: session.entries.map((entry) => (entry.kind === 'tool' && entry.id === id ? update(entry) : entry)),
  };
}
