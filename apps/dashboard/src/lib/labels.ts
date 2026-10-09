import type { Tone } from '@/components/ui/status-badge';
import type { Backend, Category, Client, Feedback, FeedbackStatus, InviteStatus, Outcome, Signal } from '@/lib/data';
import type { GoalStatus } from '@/lib/metrics';

export const SIGNALS: Record<Signal, { label: string; description: string; tone: Tone }> = {
  failed: { label: 'Error', description: 'The turn ended with an error.', tone: 'red' },
  interrupted: { label: 'Interrupted', description: 'The user stopped the turn with esc.', tone: 'amber' },
  rewound: { label: 'Rewound', description: 'The user went back to before this turn, or undid its changes.', tone: 'amber' },
  corrected: { label: 'Corrected', description: 'The user steered the turn to fix what the agent was doing.', tone: 'amber' },
  retried: { label: 'Retried', description: 'The user sent the same request again in other words.', tone: 'amber' },
  'plan-rejected': { label: 'Plan rejected', description: 'The user turned down the plan the agent wrote.', tone: 'amber' },
  'permission-denied': { label: 'Denied', description: 'The user refused a permission the agent asked for.', tone: 'neutral' },
  limit: { label: 'Limit', description: "The account's usage limit ran out.", tone: 'red' },
  compacted: { label: 'Compacted', description: 'The context filled up and was compacted.', tone: 'neutral' },
  disliked: { label: 'Disliked', description: 'The user marked the reply as bad.', tone: 'red' },
};

export const OUTCOMES: Record<Outcome, { label: string; tone: Tone }> = {
  done: { label: 'Done', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
  interrupted: { label: 'Interrupted', tone: 'amber' },
};

export const CLIENTS: Record<Client, string> = { cli: 'CLI', desktop: 'Desktop' };

export const BACKENDS: Backend[] = ['Claude', 'Codex'];

export const CATEGORIES: Record<Category, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  tests: 'Tests',
  refactor: 'Refactor',
  docs: 'Docs',
  other: 'Other',
};

export const INVITE_STATUSES: Record<InviteStatus, { label: string; tone: Tone }> = {
  active: { label: 'Waiting', tone: 'green' },
  used: { label: 'Used', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'amber' },
  revoked: { label: 'Revoked', tone: 'red' },
};

export const FEEDBACK_KINDS: Record<Feedback['kind'], { label: string; tone: Tone }> = {
  disliked: { label: 'Disliked', tone: 'red' },
  liked: { label: 'Liked', tone: 'green' },
  note: { label: 'Note', tone: 'neutral' },
};

export const FEEDBACK_STATUSES: Record<FeedbackStatus, { label: string; tone: Tone }> = {
  new: { label: 'New', tone: 'sky' },
  reviewed: { label: 'Reviewed', tone: 'neutral' },
  resolved: { label: 'Resolved', tone: 'green' },
};

export const GOAL_STATUSES: Record<GoalStatus, { label: string; tone: Tone }> = {
  'on-track': { label: 'On track', tone: 'green' },
  'at-risk': { label: 'At risk', tone: 'amber' },
  met: { label: 'Met', tone: 'green' },
  missed: { label: 'Missed', tone: 'red' },
};
