import { describe, expect, it } from 'vitest';
import type { AgentEvent } from './agent/types.js';
import { createSession, reduce, type Session } from './session.js';

const events = (session: Session, ...list: AgentEvent[]) =>
  list.reduce((current, event) => reduce(current, { type: 'event', event }), session);

const kinds = (session: Session) => session.entries.map((entry) => (entry.kind === 'tool' ? `tool:${entry.status}` : entry.kind));

describe('reduce', () => {
  it('starts a turn with the user’s text, titled after it', () => {
    const session = reduce(createSession(200_000), { type: 'submit', text: 'fix the build', prompt: 'fix the build\nfully' });
    expect(session.entries.at(-1)).toMatchObject({ kind: 'user', text: 'fix the build', prompt: 'fix the build\nfully' });
    expect(session.title).toBe('fix the build');
    expect(session.busySince).toBeTypeOf('number');
  });

  it('joins streamed text into one entry until something else comes in between', () => {
    const session = events(
      createSession(200_000),
      { type: 'text', delta: '  Hello' },
      { type: 'text', delta: ' there' },
      { type: 'thinking', delta: 'hmm' },
      { type: 'text', delta: 'Done' },
    );
    expect(session.entries.slice(-3).map((entry) => ('text' in entry ? entry.text : ''))).toEqual(['Hello there', 'hmm', 'Done']);
  });

  it('runs tools from start to end, with their output', () => {
    const session = events(
      createSession(200_000),
      { type: 'tool-start', id: 't1', call: { name: 'bash', input: { command: 'ls', timeoutMs: 1000 } } },
      { type: 'tool-output', id: 't1', lines: ['a.ts'] },
      { type: 'tool-end', id: 't1', ok: true, result: { exitCode: 0, wallMs: 5 } },
    );
    expect(session.entries.at(-1)).toMatchObject({ status: 'done', output: ['a.ts'], run: { result: { exitCode: 0 } } });
  });

  it('replaces consecutive todo updates and keeps the list', () => {
    const todo = (text: string): AgentEvent => ({
      type: 'tool-start',
      id: text,
      call: { name: 'todo', input: { groups: [{ title: 'Tasks', items: [{ text, status: 'pending' }] }] } },
    });
    const session = events(createSession(200_000), todo('one'), todo('two'));
    expect(kinds(session).filter((kind) => kind.startsWith('tool'))).toHaveLength(1);
    expect(session.todos[0]!.items[0]!.text).toBe('two');
  });

  it('cancels tools still running when the turn ends, and says why it ended', () => {
    let session = reduce(createSession(200_000), { type: 'submit', text: 'go' });
    session = events(session, { type: 'tool-start', id: 't1', call: { name: 'glob', input: { pattern: '*' } } });
    session = reduce(session, { type: 'finish', outcome: 'interrupted' });
    expect(kinds(session).slice(-2)).toEqual(['tool:cancelled', 'notice']);
    expect(session.busySince).toBeUndefined();
    session = reduce(session, { type: 'finish', outcome: 'failed', message: 'Rate limited' });
    expect(session.entries.at(-1)).toMatchObject({ kind: 'notice', text: 'Rate limited', tone: 'error' });
  });
});
