import { afterEach, describe, expect, it } from 'vitest';
import { darkTheme, Text } from '@jinion/tui';
import { renderTerminal, type TestTerminal } from '@jinion/tui/testing';
import { createSessionState } from '@jinion/core/conversation/session';
import type { StatusData } from '../../src/status/segment.js';
import { context, limits } from '../../src/status/segments/usage.js';

const NOW = Date.UTC(2026, 9, 4, 12);

const data = (): StatusData => ({
  version: '0.0.0',
  cwd: '/code/api',
  agent: 'Claude',
  model: { name: 'Opus 5.5', selection: { model: 'opus' } },
  mode: 'edits',
  session: { ...createSessionState(1_000_000), usage: { contextTokens: 59_400, contextWindow: 1_000_000, cost: 0 } },
  limits: [
    { label: '5h', used: 0.24, resetsAt: NOW + 90 * 60_000 },
    { label: '7d', used: 0.91 },
  ],
  now: NOW,
  theme: darkTheme,
});

let terminal: TestTerminal | undefined;
afterEach(() => terminal?.unmount());

const shown = async (node: unknown) => {
  terminal = renderTerminal(<Text>{node as string}</Text>, { columns: 80, rows: 4 });

  return (await terminal.screen()).trim();
};

describe('the status line’s usage', () => {
  it('tells how much of each plan window is left, which is what decides whether to go on', async () => {
    expect(await shown(limits.render(data(), 'both'))).toBe('5h 76% left · 7d 9% left');
    expect(await terminal!.colorOf('9% left')).toBe(darkTheme.error);
    expect(await shown(limits.render(data(), 'session'))).toBe('5h 76% left · resets in 1h 30m');
    expect(await shown(limits.render(data(), 'bar'))).toBe('5h [========--] 76% left');
  });

  it('writes a context window of a million as 1M', async () => {
    expect(await shown(context.render(data(), 'tokens'))).toBe('ctx: 59K/1M');
  });
});
