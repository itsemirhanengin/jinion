import { demoSessions } from '../agent/demo/sessions.js';
import { firstPrompt, type SavedSession } from '../conversation/session.js';
import { FileSessionStore, MemorySessionStore } from '../conversation/store.js';
import type { SavedSummary } from './schemas.js';

/** A folder's saved conversations, newest first, read from disk without starting its core. */
export function savedSessions(cwd: string, demo = false): SavedSummary[] {
  const store = demo ? new MemorySessionStore(demoSessions()) : new FileSessionStore(cwd);

  return store.list().map(savedSummary);
}

export function savedSummary(session: SavedSession): SavedSummary {
  const { id, title, updatedAt, entries, worktree } = session;
  const messages = entries.filter((entry) => entry.kind === 'user' || entry.kind === 'text').length;

  return { id, title, updatedAt, messages, firstPrompt: firstPrompt(session), worktree: worktree?.name };
}
