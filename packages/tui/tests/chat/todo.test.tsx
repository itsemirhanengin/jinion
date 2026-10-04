import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodoPanel, type TodoGroup } from '../../src/chat/todo.js';
import { renderTerminal, type TestTerminal } from '../../src/testing/index.js';

/** `done` steps done, the next one active, the rest pending. */
const list = (done: number, total: number): TodoGroup[] => [
  {
    title: 'Ship it',
    items: Array.from({ length: total }, (_, index) => ({
      text: `Step ${index + 1}`,
      status: index < done ? 'done' : index === done ? 'active' : 'pending',
    })),
  },
];

let terminal: TestTerminal | undefined;
afterEach(() => terminal?.unmount());

describe('TodoPanel', () => {
  it('keeps the last done items in view and counts the ones before', async () => {
    terminal = renderTerminal(<TodoPanel groups={list(8, 10)} keepDone={2} />, { columns: 60, rows: 16 });

    const screen = await terminal.waitFor('Step 9');

    expect(screen).toContain('- TODO · 8/10');
    expect(screen).toContain('[x] 6 done');
    expect(screen).toContain('[x] Step 7');
    expect(screen).toContain('[x] Step 8');
    expect(screen).not.toContain('Step 6');
    expect(screen).toContain('[ ] Step 10');
  });

  it('folds to one line with the count and the step being done, and says so on a click', async () => {
    const toggle = vi.fn();

    terminal = renderTerminal(<TodoPanel groups={list(8, 10)} folded onToggle={toggle} />, { columns: 60, rows: 16 });

    const screen = await terminal.waitFor('Step 9');

    expect(screen.split('\n').filter((line) => line.trim())).toEqual([' + TODO · 8/10 · [/] Step 9']);

    await terminal.click('TODO');
    expect(toggle).toHaveBeenCalledOnce();
  });
});
