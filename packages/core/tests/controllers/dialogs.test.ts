import { createStore } from 'jotai/vanilla';
import { describe, expect, it, vi } from 'vitest';
import type { SessionContext } from '../../src/controllers/context.js';
import { DialogCancelled, DialogController } from '../../src/controllers/dialogs.js';
import { createSessionState } from '../../src/conversation/session.js';
import { sessionAtoms } from '../../src/state/session.js';

function setup() {
  const store = createStore();
  const atoms = sessionAtoms({ state: createSessionState(200_000), selection: { model: 'demo' }, mode: 'edits', worktree: false });
  const notify = vi.fn();
  const dialogs = new DialogController({ store, atoms, notify } as unknown as SessionContext);

  return { dialogs, notify, shown: () => store.get(atoms.dialog) };
}

const question = (prompt: string) => ({ id: prompt, prompt, options: [{ label: 'Yes' }] });

describe('DialogController', () => {
  it('shows one dialog at a time, in the order they were asked, and says so', async () => {
    const { dialogs, notify, shown } = setup();
    const first = dialogs.open({ id: 'ask', questions: [question('first')] }, { message: 'jinion asks: first' });
    const second = dialogs.open({ id: 'permission', request: { title: 'Run pnpm test' } });

    await Promise.resolve();
    expect(shown()).toMatchObject({ id: 'ask' });
    expect(notify).toHaveBeenCalledWith('jinion asks: first');

    dialogs.answer([{ options: [0] }]);
    expect(await first).toEqual([{ options: [0] }]);

    await Promise.resolve();
    expect(shown()).toMatchObject({ id: 'permission' });

    dialogs.answer({ allow: true });
    expect(await second).toEqual({ allow: true });
    expect(shown()).toBeUndefined();
  });

  it('rejects a cancelled dialog and goes on to the next one', async () => {
    const { dialogs, shown } = setup();
    const first = dialogs.open({ id: 'ask', questions: [question('first')] });
    const second = dialogs.open({ id: 'ask', questions: [question('second')] });

    await Promise.resolve();
    dialogs.cancel();
    await expect(first).rejects.toBeInstanceOf(DialogCancelled);

    await Promise.resolve();
    expect(shown()).toMatchObject({ questions: [{ prompt: 'second' }] });

    dialogs.answer([{ options: [0] }]);
    expect(await second).toEqual([{ options: [0] }]);
  });

  it('takes a dialog away when its turn stops, and never shows the ones still waiting for it', async () => {
    const { dialogs, shown } = setup();
    const turn = new AbortController();
    const first = dialogs.open({ id: 'ask', questions: [question('first')] }, { signal: turn.signal });
    const second = dialogs.open({ id: 'ask', questions: [question('second')] }, { signal: turn.signal });

    await Promise.resolve();
    turn.abort(new Error('interrupted'));

    await expect(first).rejects.toThrow('interrupted');
    await expect(second).rejects.toThrow('interrupted');
    expect(shown()).toBeUndefined();
  });
});
