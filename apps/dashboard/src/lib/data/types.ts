export type Client = 'cli' | 'desktop';

export type Backend = 'Claude' | 'Codex';

export type Outcome = 'done' | 'failed' | 'interrupted';

/** What a turn makes us suspect went wrong, from what the user did and what the agent reported. */
export type Signal =
  | 'failed'
  | 'interrupted'
  | 'rewound'
  | 'corrected'
  | 'retried'
  | 'plan-rejected'
  | 'permission-denied'
  | 'limit'
  | 'compacted'
  | 'disliked';

export type Category = 'frontend' | 'backend' | 'tests' | 'refactor' | 'docs' | 'other';

export interface Admin {
  name: string;
  initials: string;
  email: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  /** The invite code they joined with. */
  invite: string;
  joinedAt: string;
  version: string;
  device: string;
}

export interface Turn {
  id: string;
  user: string;
  session: string;
  project: string;
  startedAt: string;
  durationMs: number;
  client: Client;
  backend: Backend;
  model: string;
  outcome: Outcome;
  category: Category;
  tokens: { input: number; output: number; cached: number };
  tools: number;
  signals: Signal[];
}

export interface TurnStep {
  offsetMs: number;
  kind: 'prompt' | 'thinking' | 'tool' | 'reply' | 'steer' | 'signal';
  label: string;
  detail?: string;
  durationMs?: number;
  ok?: boolean;
}

export type FeedbackStatus = 'new' | 'reviewed' | 'resolved';

export interface Feedback {
  id: string;
  user: string;
  turn?: string;
  at: string;
  kind: 'disliked' | 'liked' | 'note';
  note?: string;
  status: FeedbackStatus;
  /** The conversation, only when the user chose to send it along. */
  shared?: { prompt: string; reply: string };
}

export interface Invite {
  code: string;
  /** Who it is for, as the admin wrote it. */
  note: string;
  createdAt: string;
  expiresAt?: string;
  maxUses: number;
  usedBy: string[];
  revokedAt?: string;
}

export type InviteStatus = 'active' | 'used' | 'expired' | 'revoked';

export type MetricId = 'active-users' | 'retained' | 'active-days' | 'success-rate' | 'problem-rate' | 'turns-per-day';

export interface Goal {
  id: string;
  name: string;
  metric: MetricId;
  target: number;
  startsAt: string;
  deadline: string;
  /** What the admin decided to do when the goal is met, and when it is missed. */
  ifMet: string;
  ifMissed: string;
}
