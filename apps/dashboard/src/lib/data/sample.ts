import { random } from './random';
import type { Backend, Category, Client, Feedback, Goal, Invite, Signal, Turn, User } from './types';

// Two weeks into a beta that starts on Sunday, October 11; the sample data's "now", so the screens look lived in.
export const NOW = '2026-10-25T14:00:00.000Z';
export const BETA_START = '2026-10-11T05:00:00.000Z';

const DAY = 24 * 60 * 60 * 1000;
const BETA_DAYS = 15;

interface Profile {
  user: User;
  /** The first and last day of the beta they use Jinion on. */
  from: number;
  until: number;
  turnsPerDay: [number, number];
  weekdaysOnly?: boolean;
  clients: Client[];
  backends: Backend[];
  projects: string[];
  /** How much more often than usual their turns go wrong. */
  trouble: number;
  /** Runs out of their accounts' limits now and then, late in the day. */
  hitsLimits?: boolean;
}

const profiles: Profile[] = [
  {
    user: user('emirhan', 'Emirhan Engin', 'JN-7Q4K-2M9X', 0, '0.1.0', 'macOS 26 · Apple M4 Max'),
    from: 0,
    until: 14,
    turnsPerDay: [110, 170],
    clients: ['cli', 'cli', 'desktop'],
    backends: ['Claude', 'Claude', 'Claude', 'Codex'],
    projects: ['jinion', 'sit', 'praslea', 'website', 'dashboard', 'mobile-app', 'docs', 'benufo', 'landing', 'ricardo'],
    trouble: 1,
    hitsLimits: true,
  },
  {
    user: user('mert', 'Mert Aydın', 'JN-3H8P-6TQ2', 0, '0.1.0', 'macOS 15 · Apple M3 Pro'),
    from: 0,
    until: 14,
    turnsPerDay: [35, 65],
    clients: ['cli'],
    backends: ['Claude'],
    projects: ['checkout', 'design-system', 'admin'],
    trouble: 0.8,
  },
  {
    user: user('selin', 'Selin Kaya', 'JN-9W2D-4KZ7', 0, '0.0.14', 'macOS 15 · Apple M2'),
    from: 0,
    until: 2,
    turnsPerDay: [14, 26],
    clients: ['desktop'],
    backends: ['Claude'],
    projects: ['portfolio', 'booking-app'],
    trouble: 2.6,
  },
  {
    user: user('burak', 'Burak Demir', 'JN-5R7M-8XB3', 0, '0.0.14', 'macOS 26 · Apple M3'),
    from: 0,
    until: 14,
    turnsPerDay: [12, 30],
    weekdaysOnly: true,
    clients: ['desktop', 'desktop', 'cli'],
    backends: ['Claude', 'Codex'],
    projects: ['crm', 'reports'],
    trouble: 1.2,
  },
  {
    user: user('deniz', 'Deniz Yılmaz', 'JN-2C6V-1NH5', 4, '0.1.0', 'macOS 26 · Apple M1 Pro'),
    from: 4,
    until: 14,
    turnsPerDay: [3, 14],
    clients: ['cli'],
    backends: ['Codex', 'Codex', 'Claude'],
    projects: ['api-gateway', 'infra'],
    trouble: 1,
  },
];

export const users: User[] = profiles.map((profile) => profile.user);

const categories: Category[] = ['frontend', 'frontend', 'frontend', 'frontend', 'backend', 'backend', 'tests', 'refactor', 'refactor', 'docs', 'other'];

const models: Record<Backend, string[]> = {
  Claude: ['Claude Opus', 'Claude Opus', 'Claude Sonnet'],
  Codex: ['GPT-5 Codex'],
};

// How often each signal comes up in an ordinary turn, before a user's `trouble`.
const odds: [Signal, number][] = [
  ['corrected', 0.06],
  ['interrupted', 0.05],
  ['compacted', 0.04],
  ['retried', 0.035],
  ['rewound', 0.03],
  ['failed', 0.025],
  ['permission-denied', 0.02],
  ['plan-rejected', 0.01],
];

export const turns: Turn[] = profiles.flatMap(turnsOf).sort((a, b) => b.startedAt.localeCompare(a.startedAt));

export const feedback: Feedback[] = [
  {
    ...feedbackOn('selin', 1, 'disliked'),
    note: 'It rewrote my whole component instead of just fixing the spacing.',
    status: 'reviewed',
    shared: {
      prompt: 'The cards in the booking list have uneven spacing on mobile, can you fix it?',
      reply: 'I rebuilt BookingCard with a new layout: it now uses a grid with the image on top, and I moved the price into a badge…',
    },
  },
  {
    ...feedbackOn('selin', 2, 'note'),
    note: 'The desktop app froze twice while it was running tests. Going back to Cursor for now.',
    status: 'new',
  },
  {
    ...feedbackOn('mert', 3, 'disliked'),
    note: 'Ignored the design tokens and hard-coded colors.',
    status: 'resolved',
    shared: {
      prompt: 'Add a danger variant to Button that matches the rest of the design system.',
      reply: 'Added `variant="danger"` with `bg-[#e5484d]` and a darker hover, `#dc3e42`…',
    },
  },
  { ...feedbackOn('mert', 6, 'liked'), note: 'Steering while it works is great, it picked up my note right away.', status: 'reviewed' },
  {
    ...feedbackOn('burak', 4, 'disliked'),
    note: 'Codex kept asking for permission for every single command.',
    status: 'new',
  },
  {
    ...feedbackOn('emirhan', 6, 'note'),
    note: 'Hit the limit on all three accounts by 11pm. Switching accounts should be one key.',
    status: 'reviewed',
  },
  {
    ...feedbackOn('deniz', 9, 'disliked'),
    note: 'The plan was fine but it skipped the migration step when building it.',
    status: 'new',
    shared: {
      prompt: 'Plan the move of rate limiting from the gateway into each service.',
      reply: 'Done: each service now reads its limits from config and the gateway no longer counts requests. Tests pass.',
    },
  },
  { ...feedbackOn('emirhan', 12, 'liked'), note: 'The sidebar of conversations is so much easier with ten projects open.', status: 'reviewed' },
  {
    ...feedbackOn('mert', 13, 'disliked'),
    note: 'It said the tests passed but it never ran them.',
    status: 'new',
    shared: {
      prompt: 'Fix the flaky checkout test and make sure the suite is green.',
      reply: 'I fixed the race in `checkout.test.ts` by awaiting the cart update. The suite should pass now.',
    },
  },
];

export const invites: Invite[] = [
  ...profiles.map(({ user, from }) => ({
    code: user.invite,
    note: user.name,
    createdAt: new Date(Date.parse(BETA_START) + (from - 2) * DAY).toISOString(),
    expiresAt: new Date(Date.parse(BETA_START) + (from + 12) * DAY).toISOString(),
    maxUses: 1,
    usedBy: [user.id],
  })),
  { code: 'JN-8L3F-7PD4', note: 'Can, after the first round', createdAt: '2026-10-22T09:12:00.000Z', expiresAt: '2026-11-08T21:00:00.000Z', maxUses: 1, usedBy: [] },
  { code: 'JN-4T9B-3GW6', note: 'Second round, a team of three', createdAt: '2026-10-24T15:40:00.000Z', maxUses: 3, usedBy: [] },
  { code: 'JN-6K1S-5YE8', note: 'Ece', createdAt: '2026-10-09T10:00:00.000Z', expiresAt: '2026-10-16T21:00:00.000Z', maxUses: 1, usedBy: [] },
  {
    code: 'JN-1Z5N-9QA2',
    note: 'Sent to the wrong address',
    createdAt: '2026-10-12T08:30:00.000Z',
    maxUses: 1,
    usedBy: [],
    revokedAt: '2026-10-12T08:41:00.000Z',
  },
];

export const goals: Goal[] = [
  {
    id: 'still-using',
    name: 'Still using it after two weeks',
    metric: 'retained',
    target: 80,
    startsAt: BETA_START,
    deadline: '2026-10-25T21:00:00.000Z',
    ifMet: 'Open a second round to 20–30 people I don’t know.',
    ifMissed: 'Talk to everyone who stopped before inviting anyone else.',
  },
  {
    id: 'clean-turns',
    name: 'Turns that go well',
    metric: 'success-rate',
    target: 85,
    startsAt: BETA_START,
    deadline: '2026-11-08T21:00:00.000Z',
    ifMet: 'Spend the next month on new features rather than fixes.',
    ifMissed: 'Freeze features and fix the top three signals first.',
  },
  {
    id: 'daily-habit',
    name: 'Part of the week',
    metric: 'active-days',
    target: 4,
    startsAt: BETA_START,
    deadline: '2026-11-01T21:00:00.000Z',
    ifMet: 'Jinion is a habit: start on paid token plans.',
    ifMissed: 'Find out what they open instead, and why.',
  },
  {
    id: 'problem-turns',
    name: 'Few turns go wrong',
    metric: 'problem-rate',
    target: 12,
    startsAt: BETA_START,
    deadline: '2026-11-08T21:00:00.000Z',
    ifMet: 'Keep the weekly bug-fix round as it is.',
    ifMissed: 'Double the bug-fix rounds until it is under 12%.',
  },
];

function user(id: string, name: string, invite: string, day: number, version: string, device: string): User {
  const [first = id] = name.split(' ');

  return {
    id,
    name,
    email: `${first.toLocaleLowerCase('en').normalize('NFD').replace(/[^a-z]/g, '')}@example.com`,
    invite,
    joinedAt: new Date(Date.parse(BETA_START) + day * DAY + 3 * 60 * 60 * 1000).toISOString(),
    version,
    device,
  };
}

function turnsOf(profile: Profile): Turn[] {
  const rand = random(profile.user.id.length * 7919 + profile.turnsPerDay[1]);
  const all: Turn[] = [];

  for (let day = profile.from; day <= profile.until && day < BETA_DAYS; day++) {
    const start = Date.parse(BETA_START) + day * DAY;
    const weekday = new Date(start).getUTCDay();
    if (profile.weekdaysOnly && (weekday === 0 || weekday === 6)) continue;

    // The last day is today, cut short at the sample's "now".
    const end = Math.min(start + 18 * 60 * 60 * 1000, Date.parse(NOW));
    const count = Math.round(rand.between(...profile.turnsPerDay) * ((end - start) / (18 * 60 * 60 * 1000)));
    const times = Array.from({ length: count }, () => start + Math.floor(rand.next() * (end - start))).sort((a, b) => a - b);

    let session = '';
    let project = '';

    times.forEach((time, index) => {
      if (index % rand.between(6, 18) === 0 || !session) {
        project = rand.pick(profile.projects);
        session = `${profile.user.id}-${day}-${index}`;
      }

      const backend = rand.pick(profile.backends);
      const lateAtNight = new Date(time).getUTCHours() >= 18;
      const signals = odds.flatMap(([signal, chance]) => (rand.chance(chance * profile.trouble) ? [signal] : []));

      if (profile.hitsLimits && lateAtNight && day % 3 === 0 && rand.chance(0.25)) signals.push('limit');
      if (signals.includes('failed') && signals.includes('interrupted')) signals.splice(signals.indexOf('interrupted'), 1);

      const input = rand.between(8, 180) * 1000;

      all.push({
        id: `t-${profile.user.id}-${day}-${index}`,
        user: profile.user.id,
        session,
        project,
        startedAt: new Date(time).toISOString(),
        durationMs: Math.round(6000 + rand.next() ** 2 * 360_000),
        client: rand.pick(profile.clients),
        backend,
        model: rand.pick(models[backend]),
        outcome: signals.includes('failed') || signals.includes('limit') ? 'failed' : signals.includes('interrupted') ? 'interrupted' : 'done',
        category: rand.pick(categories),
        tokens: { input, output: rand.between(3, 120) * 100, cached: Math.round(input * (0.55 + rand.next() * 0.4)) },
        tools: rand.between(0, 28),
        signals,
      });
    });
  }

  return all;
}

/** A turn of theirs on that day to hang the feedback on; a dislike marks the turn too. */
function feedbackOn(userId: string, day: number, kind: Feedback['kind']): Omit<Feedback, 'status'> {
  const start = Date.parse(BETA_START) + day * DAY;
  const theirs = turns.filter((turn) => turn.user === userId && Date.parse(turn.startedAt) >= start && Date.parse(turn.startedAt) < start + DAY);
  // A like goes with a turn that went well, anything else with one that had trouble.
  const turn = theirs.findLast((candidate) => (kind === 'liked') === (candidate.signals.length === 0)) ?? theirs.at(-1);
  if (!turn) throw new Error(`The sample data has no turn of ${userId} on day ${day}.`);

  if (kind === 'disliked') turn.signals.push('disliked');

  return {
    id: `f-${userId}-${day}`,
    user: userId,
    turn: turn.id,
    at: new Date(Date.parse(turn.startedAt) + turn.durationMs + 60_000).toISOString(),
    kind,
  };
}
