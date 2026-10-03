import type { Status } from '@jinion/tui';
import type { NoticeTone } from '@jinion/tui/chat';
import type { AgentEvent } from '../agent/events.js';
import { applyEvent } from './apply-event.js';
import { turnChanges } from './edits.js';
import { isBackground, lastToolRun, nextId, noticeEntry, type Entry } from './entries.js';
import { addEntries, createSession, fromSaved, updateTool, type SavedSession, type Session } from './session.js';
import { titleOf } from './titles.js';

export type Action =
  | { type: 'submit'; text: string; prompt?: string }
  | { type: 'agent-turn' }
  | { type: 'approval'; id: string; waiting: boolean }
  | { type: 'steer'; text: string; prompt?: string; id?: string }
  /** `session` may have been switched away from meanwhile. */
  | { type: 'retitle'; session: string; title: string; by: 'agent' | 'user'; turns: number }
  | { type: 'rewind'; entry: string }
  | { type: 'event'; event: AgentEvent }
  | { type: 'finish'; outcome: TurnOutcome; message?: string }
  | { type: 'notice'; text: string; tone?: NoticeTone }
  | { type: 'clear' }
  | { type: 'load'; session: SavedSession };

export type TurnOutcome = 'done' | 'interrupted' | 'failed';

/** Pure, so everything that happens on screen can be tested without React. */
export function reduce(session: Session, action: Action): Session {
  return endThinking(session, next(session, action));
}

function endThinking(before: Session, after: Session): Session {
  const open = before.entries.at(-1);
  if (open?.kind !== 'thinking' || open.endedAt !== undefined) return after;
  const index = after.entries.findIndex((entry) => entry.id === open.id);
  if (index === -1 || (index === after.entries.length - 1 && after.busySince !== undefined)) return after;
  const entries = after.entries.map((entry, at) => (at === index ? { ...entry, endedAt: Date.now() } : entry));
  return { ...after, entries };
}

function next(session: Session, action: Action): Session {
  switch (action.type) {
    case 'submit':
      return {
        ...addEntries(session, { id: nextId(), kind: 'user', text: action.text, prompt: action.prompt }),
        title: session.title ?? titleOf(action.text),
        busySince: Date.now(),
        turnFrom: session.entries.length,
      };
    case 'agent-turn':
      return { ...session, busySince: Date.now(), turnFrom: session.entries.length };
    case 'retitle':
      if (action.session !== session.id) return session;
      return { ...session, title: action.title, titled: { by: action.by, turns: action.turns, at: Date.now() } };
    case 'steer':
      return addEntries(session, {
        id: nextId(),
        kind: 'user',
        text: action.text,
        prompt: action.prompt,
        steered: true,
        promptId: action.id,
      });
    case 'event':
      return applyEvent(session, action.event);
    case 'approval':
      return updateTool(session, action.id, ({ waiting: _, ...entry }) =>
        action.waiting ? { ...entry, waiting: true } : { ...entry, approvedAt: Date.now() },
      );
    case 'finish':
      return finish(session, action.outcome, action.message);
    case 'notice':
      return addEntries(session, noticeEntry(action.text, action.tone ?? 'muted'));
    case 'clear':
      return createSession(session.usage.contextWindow);
    case 'load':
      return fromSaved(action.session);
    case 'rewind': {
      const index = session.entries.findIndex((entry) => entry.id === action.entry);
      if (index === -1) return session;
      const entries = session.entries.slice(0, index);
      // The task list goes back to what the last update before that message showed.
      return { ...session, entries, todos: lastToolRun(entries, 'todo')?.input.groups ?? [] };
    }
  }
}

function finish(session: Session, outcome: TurnOutcome, message?: string): Session {
  const cancel = <T extends { status: Status; endedAt?: number }>(call: T): T =>
    call.status === 'running' ? { ...call, status: 'cancelled', endedAt: Date.now() } : call;
  // A subagent sent to the background goes on after the turn, and its calls with it.
  const entries: Entry[] = session.entries.map((entry) =>
    entry.kind !== 'tool'
      ? entry
      : { ...cancel(entry), children: isBackground(entry) ? entry.children : entry.children?.map(cancel) },
  );
  const changes = turnChanges(entries, session.turnFrom ?? entries.length);
  if (changes) entries.push(changes);
  if (outcome === 'interrupted') entries.push(noticeEntry('Interrupted. Tell jinion what to do instead.', 'warning'));
  if (outcome === 'failed') entries.push(noticeEntry(message ?? 'Something went wrong.', 'error'));
  return { ...session, entries, busySince: undefined, turnFrom: undefined, compacting: undefined };
}
