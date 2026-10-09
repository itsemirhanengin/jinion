import { BETA_START, NOW } from '@/lib/clock';
import { inviteStatus, listFeedback, listInvites, listTurns, listUsers, type Signal, type Turn } from '@/lib/data';
import { DAY, dayOf, startOfDay } from '@/lib/days';
import { goalCards } from '@/lib/goal-cards';
import { BACKENDS, CATEGORIES, CLIENTS } from '@/lib/labels';
import { isQuiet } from '@/lib/lists/users';
import { dayByDay, figure, lastWeek, measure } from '@/lib/metrics';
import { hasProblem, isProblem } from '@/lib/problems';

export interface Share {
  label: string;
  turns: number;
  /** Turns with a problem, out of all of them, from 0 to 1. */
  problemRate: number;
}

/** Everything the overview shows, worked out on the server so the page gets numbers rather than thousands of turns. */
export async function overview() {
  const [turns, users, feedback, invites, { cards }] = await Promise.all([listTurns(), listUsers(), listFeedback(), listInvites(), goalCards()]);
  const now = Date.parse(NOW);
  const week = lastWeek(turns, now);
  const weekBefore = lastWeek(turns, now - 7 * DAY);

  return {
    summary: {
      active: measure('active-users', turns, users, now),
      people: users.length,
      wentWell: measure('success-rate', turns, users, now),
      atRisk: cards.filter((card) => card.track.status === 'at-risk').length,
      turnsThisWeek: week.length,
    },
    figures: (['active-users', 'retained', 'success-rate', 'turns-per-day'] as const).map((id) => figure(id, turns, users)),
    goals: cards,
    attention: {
      feedback: feedback.filter((item) => item.status === 'new').slice(0, 3),
      people: users.map((user): [string, string] => [user.id, user.name]),
      quiet: users.filter((user) => isQuiet(user, NOW)).map((user) => ({ id: user.id, name: user.name, lastSeenAt: user.lastSeenAt })),
      waitingInvites: invites.filter((invite) => inviteStatus(invite) === 'active').length,
    },
    activity: activityGrid(turns, users),
    days: dayByDay(turns),
    signals: signalCounts(week, weekBefore),
    compare: {
      agent: shares(week, BACKENDS.map((backend) => [backend, backend]), (turn) => turn.backend),
      client: shares(week, Object.entries(CLIENTS), (turn) => turn.client),
      work: shares(week, Object.entries(CATEGORIES), (turn) => turn.category),
    },
    tokens: tokensByDay(turns),
    limitsThisWeek: week.filter((turn) => turn.signals.includes('limit')).length,
  };
}

export type Overview = Awaited<ReturnType<typeof overview>>;

/** Each person's turns on each day of the beta, and how many of them had a problem. */
function activityGrid(turns: Turn[], users: { id: string; name: string; joinedAt: string }[]) {
  const days: string[] = [];

  for (let day = startOfDay(Date.parse(BETA_START)); day < Date.parse(NOW); day += DAY) days.push(dayOf(new Date(day + 1).toISOString()));

  const counts = new Map<string, { turns: number; problems: number }>();

  for (const turn of turns) {
    const key = `${turn.user}:${dayOf(turn.startedAt)}`;
    const cell = counts.get(key) ?? { turns: 0, problems: 0 };

    cell.turns++;
    if (hasProblem(turn)) cell.problems++;
    counts.set(key, cell);
  }

  return {
    days,
    people: users.map((user) => ({
      id: user.id,
      name: user.name,
      joined: dayOf(user.joinedAt),
      cells: days.map((day) => counts.get(`${user.id}:${day}`) ?? { turns: 0, problems: 0 }),
    })),
  };
}

/** How often each kind of problem came up this week and the week before, the most frequent first. */
function signalCounts(week: Turn[], weekBefore: Turn[]) {
  const count = (from: Turn[], signal: Signal) => from.filter((turn) => turn.signals.includes(signal)).length;
  const signals = [...new Set([...week, ...weekBefore].flatMap((turn) => turn.signals))].filter(isProblem);

  return signals
    .map((signal) => ({ signal, thisWeek: count(week, signal), weekBefore: count(weekBefore, signal) }))
    .sort((a, b) => b.thisWeek - a.thisWeek);
}

function shares(week: Turn[], groups: [string, string][], key: (turn: Turn) => string): Share[] {
  return groups
    .map(([value, label]) => {
      const ofGroup = week.filter((turn) => key(turn) === value);

      return { label, turns: ofGroup.length, problemRate: ofGroup.length ? ofGroup.filter(hasProblem).length / ofGroup.length : 0 };
    })
    .filter((share) => share.turns > 0);
}

/** Input and output tokens each day, by agent. */
function tokensByDay(turns: Turn[]) {
  const days = new Map<string, Record<string, number>>();

  for (const turn of turns) {
    const day = dayOf(turn.startedAt);
    const entry = days.get(day) ?? { Claude: 0, Codex: 0 };

    entry[turn.backend] = (entry[turn.backend] ?? 0) + turn.tokens.input + turn.tokens.output;
    days.set(day, entry);
  }

  return [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, entry]) => ({ day: `${day}T12:00:00.000Z`, Claude: entry.Claude ?? 0, Codex: entry.Codex ?? 0 }));
}
