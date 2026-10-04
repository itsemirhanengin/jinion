import { describe, expect, it, vi } from 'vitest';
import { ScriptedBackend } from '../../src/agent/demo/agent.js';
import { demoSessions } from '../../src/agent/demo/sessions.js';
import { builtinCommands } from '../../src/commands/builtin.js';
import { CommandRegistry } from '../../src/commands/registry.js';
import type { Screen } from '../../src/controllers/context.js';
import { Jinion } from '../../src/controllers/jinion.js';
import { MemorySessionStore } from '../../src/conversation/store.js';
import { MemoryStore } from '../../src/memory/store.js';
import { activeSessionAtom } from '../../src/state/active.js';
import { sandboxEach } from '../support/sandbox.js';

const box = sandboxEach();

function setup() {
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
      saved: new MemorySessionStore(),
      memory: new MemoryStore(box.project),
      commands: new CommandRegistry(builtinCommands),
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
    expect(jinion.store.get(activeSessionAtom)).toBe(second.atoms);

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
