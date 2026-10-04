import { z } from 'zod';
import { AgentEvent } from '../agent/events.js';
import { Worktree } from '../git/types.js';
import { applyEvent } from './apply-event.js';
import { turnChanges } from './edits.js';
import { isBackground, isPrompt, lastToolRun, noticeEntry, NoticeTone, type Entry, type NewEntry, type Status } from './entries.js';
import { addNewEntries, updateTool, type SessionState } from './session.js';
import { titleOf } from './titles.js';

export const TurnOutcome = z.enum(['done', 'interrupted', 'failed']);

export type TurnOutcome = z.infer<typeof TurnOutcome>;

export const Action = z.discriminatedUnion('type', [
  z.object({ type: z.literal('submit'), text: z.string(), prompt: z.string().optional() }),
  z.object({ type: z.literal('agent-turn') }),
  z.object({ type: z.literal('approval'), id: z.string(), waiting: z.boolean() }),
  z.object({ type: z.literal('steer'), text: z.string(), prompt: z.string().optional(), id: z.string().optional() }),
  /** `session` may have been switched away from meanwhile. */
  z.object({ type: z.literal('retitle'), session: z.string(), title: z.string(), by: z.enum(['agent', 'user']), turns: z.number() }),
  z.object({ type: z.literal('rewind'), entry: z.string() }),
  z.object({ type: z.literal('event'), event: AgentEvent }),
  z.object({ type: z.literal('finish'), outcome: TurnOutcome, message: z.string().optional() }),
  z.object({ type: z.literal('notice'), text: z.string(), tone: NoticeTone.optional() }),
  z.object({ type: z.literal('worktree'), worktree: Worktree.optional() }),
  /** The conversation goes on with another backend, which knows nothing of it until it is handed over. */
  z.object({ type: z.literal('switch-agent'), agent: z.string() }),
]);

export type Action = z.infer<typeof Action>;

/** An action with the time it happened, stamped once where it is dispatched. */
export const StampedAction = z.object({ action: Action, at: z.number() });

export type StampedAction = z.infer<typeof StampedAction>;

/** An action as its session took it: stamped, and numbered in the order they came. */
export const SentAction = StampedAction.extend({ seq: z.number().int() });

export type SentAction = z.infer<typeof SentAction>;

/**
 * Pure: the same conversation and the same action, at the same time, give the same conversation anywhere. So a client
 * that replays a session's actions holds what the session holds, and everything on screen can be tested without React.
 */
export function reduce(session: SessionState, action: Action, at: number): SessionState {
  return endThinking(session, next(session, action, at), at);
}

function endThinking(before: SessionState, after: SessionState, at: number): SessionState {
  const open = before.entries.at(-1);
  if (open?.kind !== 'thinking' || open.endedAt !== undefined) return after;

  const index = after.entries.findIndex((entry) => entry.id === open.id);
  if (index === -1 || (index === after.entries.length - 1 && after.busySince !== undefined)) return after;

  const entries = after.entries.map((entry, position) => (position === index ? { ...entry, endedAt: at } : entry));

  return { ...after, entries };
}

function next(session: SessionState, action: Action, at: number): SessionState {
  switch (action.type) {
    case 'submit':
      return {
        ...addNewEntries(session, { kind: 'user', text: action.text, prompt: action.prompt }),
        title: session.title ?? titleOf(action.text),
        busySince: at,
        turnFrom: session.entries.length,
      };

    case 'agent-turn':
      return { ...session, busySince: at, turnFrom: session.entries.length };

    case 'retitle':
      if (action.session !== session.id) return session;

      return { ...session, title: action.title, titled: { by: action.by, turns: action.turns, at } };

    case 'steer':
      return addNewEntries(session, { kind: 'user', text: action.text, prompt: action.prompt, steered: true, promptId: action.id });

    case 'event':
      return applyEvent(session, action.event, at);

    case 'approval':
      return updateTool(session, action.id, ({ waiting: _, ...entry }) =>
        action.waiting ? { ...entry, waiting: true } : { ...entry, approvedAt: at },
      );

    case 'finish':
      return finish(session, action.outcome, action.message, at);

    case 'notice':
      return addNewEntries(session, noticeEntry(action.text, action.tone ?? 'muted'));

    case 'worktree':
      return { ...session, worktree: action.worktree };

    case 'switch-agent': {
      // The prompts before it belong to the other backend, which is no longer there to rewind them.
      const entries = session.entries.map((entry) => {
        if (entry.kind !== 'user') return entry;

        const { promptId: _, ...rest } = entry;

        return rest;
      });

      return { ...session, agent: action.agent, agentSession: undefined, entries, handover: entries.some(isPrompt) || undefined };
    }

    case 'rewind': {
      const index = session.entries.findIndex((entry) => entry.id === action.entry);
      if (index === -1) return session;

      const entries = session.entries.slice(0, index);

      // The task list goes back to what the last update before that message showed.
      return { ...session, entries, todos: lastToolRun(entries, 'todo')?.input.groups ?? [] };
    }
  }
}

function finish(session: SessionState, outcome: TurnOutcome, message: string | undefined, at: number): SessionState {
  const cancel = <T extends { status: Status; endedAt?: number }>(call: T): T =>
    call.status === 'running' ? { ...call, status: 'cancelled', endedAt: at } : call;

  // A subagent sent to the background goes on after the turn, and its calls with it.
  const entries: Entry[] = session.entries.map((entry) =>
    entry.kind !== 'tool'
      ? entry
      : { ...cancel(entry), children: isBackground(entry) ? entry.children : entry.children?.map(cancel) },
  );

  const changes = turnChanges(entries, session.turnFrom ?? entries.length);
  const added: NewEntry[] = [];

  if (changes) added.push(changes);
  if (outcome === 'interrupted') added.push(noticeEntry('Interrupted. Tell jinion what to do instead.', 'warning'));
  if (outcome === 'failed') added.push(noticeEntry(message ?? 'Something went wrong.', 'error'));

  return addNewEntries({ ...session, entries, busySince: undefined, turnFrom: undefined, compacting: undefined }, ...added);
}
