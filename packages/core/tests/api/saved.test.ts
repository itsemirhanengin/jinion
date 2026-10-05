import { describe, expect, it } from 'vitest';
import { savedSessions } from '../../src/api/saved.js';
import { SavedSummary } from '../../src/api/schemas.js';
import { createSessionState } from '../../src/conversation/session.js';
import { FileSessionStore } from '../../src/conversation/store.js';
import { sandboxEach } from '../support/sandbox.js';

const box = sandboxEach();

describe('savedSessions', () => {
  it('reads a folder’s saved conversations, newest first, without a core', () => {
    const store = new FileSessionStore(box.project);

    const saved = (id: string, title: string, updatedAt: number) => ({
      ...createSessionState(200_000),
      id,
      title,
      updatedAt,
      entries: [{ id: 'e1', kind: 'user' as const, text: 'fix the login page' }],
    });

    store.save(saved('old', 'Old', 1));
    store.save(saved('new', 'New', 2));

    const sessions = savedSessions(box.project);

    expect(sessions.map((session) => session.id)).toEqual(['new', 'old']);
    expect(sessions[0]).toMatchObject({ title: 'New', messages: 1, firstPrompt: 'fix the login page' });
    for (const session of sessions) SavedSummary.parse(session);
  });

  it('is empty for a folder never worked in', () => {
    expect(savedSessions(box.project)).toEqual([]);
  });

  it('plays the demo’s conversations under --demo', () => {
    expect(savedSessions(box.project, true).length).toBeGreaterThan(0);
  });
});
