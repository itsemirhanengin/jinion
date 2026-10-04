import { clip, firstLine, truncate } from '../lib/text.js';
import { editTurns } from './edits.js';
import { lastToolRun, promptCount, type Entry } from './entries.js';
import type { SessionState } from './session.js';

export const titleOf = (text: string) => truncate(firstLine(text.trim()), 60);

const RETITLE_AFTER_MS = 20 * 60_000;

/** After the first prompt, then each time the prompts double or after a while; a title the user chose stays. */
export function titleDue(session: Pick<SessionState, 'entries' | 'titled'>, now = Date.now()) {
  const turns = promptCount(session.entries);
  const { titled } = session;
  if (turns === 0 || titled?.by === 'user') return false;
  if (!titled) return true;

  return turns >= titled.turns * 2 || (turns > titled.turns && now - titled.at >= RETITLE_AFTER_MS);
}

export function conversationDigest(entries: Entry[]) {
  const prompts = entries.flatMap((entry) => (entry.kind === 'user' ? [entry.prompt ?? entry.text] : []));
  const reply = entries.findLast((entry) => entry.kind === 'text');
  const plan = lastToolRun(entries, 'plan');
  const changed = [...new Set(editTurns(entries).flatMap((turn) => turn.edits.map((change) => change.path)))];

  return [
    prompts[0] && `First message: ${clip(prompts[0], 400)}`,
    ...prompts.slice(Math.max(1, prompts.length - 5)).map((prompt) => `Later message: ${clip(prompt, 300)}`),
    plan && `Plan: ${clip(plan.input.plan, 400)}`,
    changed.length > 0 && `Files changed: ${changed.slice(0, 10).join(', ')}`,
    reply?.kind === 'text' && `Agent's latest reply: ${clip(reply.text, 500)}`,
  ]
    .filter(Boolean)
    .join('\n');
}
