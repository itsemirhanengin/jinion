import { NOW } from '@/lib/clock';
import { dayOf, weekStart } from '@/lib/days';
import { hasProblem } from '@/lib/problems';
import { random, seedOf } from './random';
import { feedback, goals, invites, turns, users } from './sample';
import type { Invite, InviteStatus, Turn, TurnStep, User } from './types';

// The one way the screens reach their data. It reads the sample data until the API is there; then only these
// functions change, so they are already async. What runs in the browser takes only types from here.

export type * from './types';

export interface UserSummary extends User {
  lastSeenAt: string | null;
  turns7d: number;
  activeDays7d: number;
  problemRate: number | null;
  clients: Turn['client'][];
  backends: Turn['backend'][];
}

export async function listUsers(): Promise<UserSummary[]> {
  return users.map(summarize);
}

export async function getUser(id: string) {
  const found = users.find((candidate) => candidate.id === id);

  return found ? summarize(found) : null;
}

export async function listTurns(filter: { user?: string } = {}) {
  return filter.user ? turns.filter((turn) => turn.user === filter.user) : turns;
}

export async function getTurn(id: string) {
  const turn = turns.find((candidate) => candidate.id === id);

  return turn ? { ...turn, steps: stepsOf(turn) } : null;
}

export async function listFeedback(filter: { user?: string } = {}) {
  const sorted = [...feedback].sort((a, b) => b.at.localeCompare(a.at));

  return filter.user ? sorted.filter((item) => item.user === filter.user) : sorted;
}

export async function listInvites() {
  return [...invites].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listGoals() {
  return goals;
}

export async function getGoal(id: string) {
  return goals.find((goal) => goal.id === id) ?? null;
}

export function inviteStatus(invite: Invite): InviteStatus {
  if (invite.revokedAt) return 'revoked';
  if (invite.usedBy.length >= invite.maxUses) return 'used';
  if (invite.expiresAt && invite.expiresAt < NOW) return 'expired';

  return 'active';
}

function summarize(user: User): UserSummary {
  const theirs = turns.filter((turn) => turn.user === user.id);
  const from = weekStart(Date.parse(NOW));
  const lastWeek = theirs.filter((turn) => Date.parse(turn.startedAt) >= from);

  return {
    ...user,
    lastSeenAt: theirs[0]?.startedAt ?? null,
    turns7d: lastWeek.length,
    activeDays7d: new Set(lastWeek.map((turn) => dayOf(turn.startedAt))).size,
    problemRate: theirs.length ? theirs.filter(hasProblem).length / theirs.length : null,
    clients: [...new Set(theirs.map((turn) => turn.client))],
    backends: [...new Set(theirs.map((turn) => turn.backend))],
  };
}

const tools = [
  ['Read', 'src/components/checkout/summary.tsx'],
  ['Grep', '"useCart"'],
  ['Edit', 'src/components/checkout/summary.tsx'],
  ['Bash', 'pnpm test checkout'],
  ['Read', 'src/app/(shop)/layout.tsx'],
  ['Write', 'src/components/ui/badge.tsx'],
  ['Bash', 'pnpm typecheck'],
  ['Glob', 'src/**/*.test.ts'],
  ['Edit', 'src/lib/cart.ts'],
] as const;

/** What happened in the turn, step by step; made up from the turn itself until the API records it. */
function stepsOf(turn: Turn): TurnStep[] {
  const rand = random(seedOf(turn.id));
  const steps: TurnStep[] = [{ offsetMs: 0, kind: 'prompt', label: 'Message sent' }];
  const count = Math.min(turn.tools, 12);
  // Each step gets a random share of the turn, so some take seconds and a test run takes most of a minute.
  const weights = Array.from({ length: count + 1 }, () => 0.2 + rand.next() ** 2 * 3);
  const unit = (turn.durationMs * 0.9) / weights.reduce((sum, weight) => sum + weight, 0);
  let at = rand.between(800, 3000);

  steps.push({ offsetMs: at, kind: 'thinking', label: 'Thought', durationMs: Math.round(weights[0]! * unit * 0.8) });

  for (let index = 0; index < count; index++) {
    const [name, target] = rand.pick(tools);
    const ok = !(turn.signals.includes('failed') && index === count - 1);
    const took = Math.round(weights[index + 1]! * unit);

    at += Math.round(weights[index]! * unit);
    steps.push({ offsetMs: at, kind: 'tool', label: name, detail: target, durationMs: Math.round(took * 0.85), ok });

    if (turn.signals.includes('corrected') && index === Math.floor(count / 2)) {
      steps.push({ offsetMs: at + 500, kind: 'steer', label: 'User steered the turn', detail: 'no, keep the existing props' });
    }
  }

  for (const signal of turn.signals) steps.push({ offsetMs: turn.durationMs, kind: 'signal', label: signal });

  if (turn.outcome === 'done') steps.push({ offsetMs: turn.durationMs, kind: 'reply', label: 'Replied' });

  return steps;
}
