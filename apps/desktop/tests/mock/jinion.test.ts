import { createStore } from 'jotai';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { MockJinion } from '../../src/renderer/mock/jinion.js';
import { projects } from '../../src/renderer/mock/projects.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function start() {
  const store = createStore();
  const jinion = new MockJinion(store, projects[0]!);
  const id = store.get(jinion.sessionsAtom).active!;
  const snapshot = () => store.get(jinion.session(id));

  return { store, jinion, id, snapshot };
}

test('plays a turn through the core reducer, ending on what it changed', async () => {
  const { store, jinion, id, snapshot } = start();

  jinion.submit(id, 'Add rate limiting to the API');
  expect(snapshot().fields.working).toBe(true);

  await vi.runAllTimersAsync();

  const { state, fields } = snapshot();
  const kinds = state.entries.map((entry) => entry.kind);

  expect(fields.working).toBe(false);
  expect(state.title).toBe('Add rate limiting to the API');
  expect(kinds).toContain('thinking');
  expect(state.entries.at(-1)).toMatchObject({ kind: 'changes', files: [{ path: 'src/middleware/rate-limit.ts', created: true }, { path: 'src/server.ts' }] });
  expect(store.get(jinion.filesAtom)['src/middleware/rate-limit.ts']).toContain('TooManyRequests');
});

test('waits on a permission, and goes on with the answer', async () => {
  const { jinion, id, snapshot } = start();

  jinion.submit(id, 'Fix the flaky session test');
  await vi.runAllTimersAsync();

  expect(snapshot().fields.dialog).toMatchObject({ id: 'permission', request: { title: 'Run the test 20 times?' } });

  jinion.answer(id, { allow: false, note: 'run it in CI instead' });
  await vi.runAllTimersAsync();

  const last = snapshot().state.entries.findLast((entry) => entry.kind === 'text');

  expect(snapshot().fields.dialog).toBeUndefined();
  expect(last).toMatchObject({ text: expect.stringContaining('run it in CI instead') });
});

test('stops a turn, and plays what was queued meanwhile next', async () => {
  const { jinion, id, snapshot } = start();

  jinion.submit(id, 'Explain how the job queue works');
  jinion.submit(id, 'Hi');
  expect(snapshot().fields.queue).toEqual([{ text: 'Hi' }]);

  jinion.interrupt(id);
  await vi.runAllTimersAsync();

  const { state, fields } = snapshot();

  expect(state.entries.some((entry) => entry.kind === 'notice' && entry.tone === 'warning')).toBe(true);
  expect(state.entries.filter((entry) => entry.kind === 'user').map((entry) => entry.text)).toEqual(['Explain how the job queue works', 'Hi']);
  expect(fields.queue).toEqual([]);
});

test('keeps a closed thread in the sidebar, and opens it again', async () => {
  const { store, jinion, id } = start();

  jinion.submit(id, 'Hi');
  await vi.runAllTimersAsync();
  jinion.close(id);

  expect(store.get(jinion.savedAtom).map((saved) => saved.title)).toContain('Hi');

  jinion.resume(id);

  expect(store.get(jinion.sessionsAtom).active).toBe(id);
  expect(store.get(jinion.savedAtom).some((saved) => saved.id === id)).toBe(false);
});
