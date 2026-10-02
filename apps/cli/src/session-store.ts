import { nextId, type Entry, type SavedSession } from './session.js';

/** Where conversations are kept between `/clear`, `/resume` and, later, runs. */
export interface SessionStore {
  /** Most recently updated first. */
  list(): SavedSession[];
  save(session: SavedSession): void;
}

export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SavedSession>();

  constructor(seed: SavedSession[] = []) {
    for (const session of seed) this.sessions.set(session.id, session);
  }

  list() {
    return [...this.sessions.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  save(session: SavedSession) {
    this.sessions.set(session.id, session);
  }
}

const HOUR = 3_600_000;

type Turn = [prompt: string, thinking: string, reply: string];

function demoSession(title: string, hoursAgo: number, turns: Turn[]): SavedSession {
  const updatedAt = Date.now() - hoursAgo * HOUR;
  const entries: Entry[] = [{ id: nextId(), kind: 'banner' }];
  for (const [prompt, thinking, reply] of turns) {
    entries.push(
      { id: nextId(), kind: 'user', text: prompt },
      { id: nextId(), kind: 'thinking', text: thinking },
      { id: nextId(), kind: 'text', text: reply },
    );
  }
  return {
    id: `demo_${nextId()}`,
    title,
    createdAt: updatedAt - HOUR,
    updatedAt,
    entries,
    todos: [],
    usage: { contextTokens: 6_000 * turns.length, contextWindow: 200_000, cost: 0.02 * turns.length },
  };
}

/** Sample history so `/resume` has something to show before sessions are saved to disk. */
export function demoSessions(): SavedSession[] {
  return [
    demoSession('Fix the flaky checkout e2e test', 2, [
      [
        'the checkout e2e test fails every few runs, can you find out why?',
        'Intermittent failures in an e2e test usually mean a race. I will look at how the test waits for the payment step.',
        'The test clicks **Pay** before the payment iframe finishes loading. I replaced the fixed `sleep(500)` with a wait on the iframe `load` event; 50 consecutive runs pass now.',
      ],
    ]),
    demoSession('Migrate auth to OIDC', 26, [
      [
        'plan the migration from our session cookies to OIDC',
        'This touches login, refresh and logout. I should map every place that reads the session cookie first.',
        'There are **7** call sites that read the cookie directly. The plan: add an OIDC client behind the existing `getSession()` seam, migrate call sites to it, then remove the cookie path.',
      ],
      [
        'start with the refresh flow',
        'Refresh is the riskiest part because tokens expire mid-request. I will handle the retry in the HTTP client.',
        'Refresh now runs in `http/client.ts`: a `401` triggers one silent refresh and replays the request.',
      ],
    ]),
    demoSession('Explain the billing reconciliation job', 74, [
      [
        'how does the nightly billing reconciliation work?',
        'I will trace the job from its schedule to where it writes corrections.',
        'It runs at 03:00 UTC, compares `invoices` against provider payouts per day, and writes mismatches to `billing_adjustments` for review instead of fixing them automatically.',
      ],
    ]),
    demoSession('Speed up the CI cache', 170, [
      [
        'CI takes 14 minutes, most of it installing dependencies',
        'The cache key probably changes on every run. Let me check how it is computed.',
        'The cache key included the commit SHA, so it never hit. Keying it on the lockfile hash brings installs from 6 minutes to 40 seconds.',
      ],
    ]),
  ];
}
