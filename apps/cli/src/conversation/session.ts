import type { TodoGroup } from '@jinion/tui/chat';
import type { AgentResume } from '../agent/agent.js';
import type { Usage } from '../agent/usage.js';
import { nextId, type Entry, type ToolEntry } from './entries.js';

export interface Session {
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
}

export type SavedSession = Omit<Session, 'busySince' | 'turnFrom' | 'compacting' | 'title'> & { title: string; updatedAt: number };

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

  const { busySince: _, turnFrom: __, compacting: ___, title, ...rest } = session;

  return { ...rest, title: title ?? prompt, updatedAt: Date.now() };
}

export function fromSaved(saved: SavedSession): Session {
  const { updatedAt: _, ...session } = saved;

  return session;
}

export const resumeOf = (saved: SavedSession): AgentResume | undefined =>
  saved.agentSession ? { sessionId: saved.agentSession, cost: saved.usage.cost } : undefined;

/** A command's output stays open until its turn ends. */
export const inRunningTurn = (session: Pick<Session, 'busySince' | 'turnFrom'>, index: number) =>
  session.busySince !== undefined && index >= (session.turnFrom ?? 0);

export const addEntries = (session: Session, ...entries: Entry[]): Session => ({
  ...session,
  entries: [...session.entries, ...entries],
});

export function updateTool(session: Session, id: string, update: (entry: ToolEntry) => Entry): Session {
  return {
    ...session,
    entries: session.entries.map((entry) => (entry.kind === 'tool' && entry.id === id ? update(entry) : entry)),
  };
}
