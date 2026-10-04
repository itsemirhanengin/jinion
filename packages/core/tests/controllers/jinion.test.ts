import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ScriptedBackend } from '../../src/agent/demo/agent.js';
import { demoSessions } from '../../src/agent/demo/sessions.js';
import { builtinCommands } from '../../src/commands/builtin.js';
import { CommandRegistry } from '../../src/commands/registry.js';
import type { Screen } from '../../src/controllers/context.js';
import { Jinion, OpenElsewhere } from '../../src/controllers/jinion.js';
import type { SavedSession } from '../../src/conversation/session.js';
import { FileSessionStore, MemorySessionStore, type SessionStore } from '../../src/conversation/store.js';
import { projectDir } from '../../src/lib/paths.js';
import { MemoryStore } from '../../src/memory/store.js';
import { sandboxEach } from '../support/sandbox.js';

const box = sandboxEach();

function setup(saved: SessionStore = new MemorySessionStore(), initial?: SavedSession) {
  const screen: Screen = {
    openView: vi.fn(),
    fillPrompt: vi.fn(),
    focused: () => true,
    notify: vi.fn(),
    notifications: 'desktop',
    toggleExpanded: vi.fn(),
    exit: vi.fn(),
  };

  const jinion = new Jinion(
    {
      backend: new ScriptedBackend([], [], 0),
      info: { version: '0.0.0', cwd: box.project },
      saved,
      memory: new MemoryStore(box.project),
      commands: new CommandRegistry(builtinCommands),
      initial,
    },
    screen,
  );

  return { jinion, screen };
}

describe('Jinion', () => {
  it('opens a saved conversation once: opening it again brings back the session that has it', () => {
    const { jinion } = setup();
    const [saved] = demoSessions();
    const first = jinion.openSession(saved);

    expect(jinion.openSession(saved)).toBe(first);
    expect(jinion.sessions).toHaveLength(2);
  });

  it('gives a new session the worktree choice it is opened with, or else the default', () => {
    const { jinion } = setup();

    expect(jinion.store.get(jinion.openSession(undefined, { worktree: true }).atoms.wantsWorktree)).toBe(true);
    expect(jinion.store.get(jinion.openSession().atoms.wantsWorktree)).toBe(false);
  });

  it('shows another session when the one the user looks at closes, and a new conversation after the last', async () => {
    const { jinion } = setup();
    const first = jinion.session;
    const second = jinion.openSession();

    jinion.activate(second);
    expect(jinion.session).toBe(second);

    await jinion.close(second);
    expect(jinion.session).toBe(first);

    await jinion.close(first);
    expect(jinion.sessions).toHaveLength(1);
    expect(jinion.session).not.toBe(first);
  });

  it('notifies about a session the user isn’t looking at, even while the window has focus', () => {
    const { jinion, screen } = setup();
    const other = jinion.openSession();

    jinion.notify('Waiting in the active one', jinion.session);
    expect(screen.notify).not.toHaveBeenCalled();

    jinion.notify('Waiting in the other one', other);
    expect(screen.notify).toHaveBeenCalledWith(expect.stringContaining('jinion'), 'Waiting in the other one');
  });
});

describe('a conversation open in another Jinion', () => {
  // The test runner's parent stands in for another Jinion: a process that runs.
  const other = process.ppid;

  function saved() {
    const store = new FileSessionStore(box.project);
    const [conversation] = demoSessions();

    store.save(conversation!);
    box.write(join(projectDir(box.project), 'sessions', `${conversation!.id}.open`), `${other}\n`);

    return { store, conversation: conversation! };
  }

  it('isn’t opened again, and /resume keeps the conversation shown', async () => {
    const { store, conversation } = saved();
    const { jinion } = setup(store);
    const shown = jinion.session;

    expect(() => jinion.openSession(conversation)).toThrow(OpenElsewhere);
    await expect(jinion.resume(conversation)).rejects.toThrow(`is open in another jinion (pid ${other})`);
    expect(jinion.session).toBe(shown);
    expect(jinion.sessions).toHaveLength(1);
  });

  it('leaves --continue with a new conversation that says why', () => {
    const { store, conversation } = saved();
    const { jinion } = setup(store, conversation);
    const entries = jinion.store.get(jinion.session.atoms.entries);

    expect(jinion.session.id).not.toBe(conversation.id);
    expect(entries.some((entry) => entry.kind === 'notice' && entry.text.includes('This is a new conversation.'))).toBe(true);
  });

  it('opens once the other Jinion is gone, and is free again once closed here', async () => {
    const { store, conversation } = saved();
    const { jinion } = setup(store);

    box.write(join(projectDir(box.project), 'sessions', `${conversation.id}.open`), `${2 ** 22}\n`);

    const session = jinion.openSession(conversation);

    expect(store.claim(conversation.id)).toBeUndefined();

    await jinion.close(session);
    expect(existsSync(join(projectDir(box.project), 'sessions', `${conversation.id}.open`))).toBe(false);
  });
});
