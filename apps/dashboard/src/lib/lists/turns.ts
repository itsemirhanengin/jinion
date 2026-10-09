import { hasProblem, type Signal, type Turn, type User } from '@/lib/data';
import type { ListConfig } from '@/lib/data-table';
import { BACKENDS, CATEGORIES, CLIENTS, OUTCOMES, SIGNALS } from '@/lib/labels';

/** A turn as its list shows it: with its person's name, and whether anyone said something about it. */
export interface TurnRow extends Turn {
  person: string;
  feedback: boolean;
}

export function turnsList(users: Pick<User, 'id' | 'name'>[]): ListConfig<TurnRow> {
  return {
    filters: [
      {
        key: 'health',
        label: 'Health',
        options: [
          { value: 'problem', label: 'Had a problem' },
          { value: 'clean', label: 'Went well' },
        ],
        test: (turn, value) => (value === 'problem') === hasProblem(turn),
      },
      {
        key: 'feedback',
        label: 'Feedback',
        options: [
          { value: 'yes', label: 'Has feedback' },
          { value: 'no', label: 'No feedback' },
        ],
        test: (turn, value) => (value === 'yes') === turn.feedback,
      },
      {
        key: 'person',
        label: 'Person',
        multiple: true,
        options: users.map((user) => ({ value: user.id, label: user.name })),
        test: (turn, value) => turn.user === value,
      },
      {
        key: 'signal',
        label: 'Signal',
        multiple: true,
        options: Object.entries(SIGNALS).map(([value, signal]) => ({ value, label: signal.label })),
        test: (turn, value) => turn.signals.includes(value as Signal),
      },
      {
        key: 'outcome',
        label: 'Outcome',
        multiple: true,
        options: Object.entries(OUTCOMES).map(([value, outcome]) => ({ value, label: outcome.label })),
        test: (turn, value) => turn.outcome === value,
      },
      {
        key: 'backend',
        label: 'Agent',
        multiple: true,
        options: BACKENDS.map((backend) => ({ value: backend, label: backend })),
        test: (turn, value) => turn.backend === value,
      },
      {
        key: 'client',
        label: 'Client',
        multiple: true,
        options: Object.entries(CLIENTS).map(([value, label]) => ({ value, label })),
        test: (turn, value) => turn.client === value,
      },
      {
        key: 'category',
        label: 'Kind of work',
        multiple: true,
        options: Object.entries(CATEGORIES).map(([value, label]) => ({ value, label })),
        test: (turn, value) => turn.category === value,
      },
    ],
    sortFields: [
      { key: 'started', label: 'Started', kind: 'date', value: (turn) => Date.parse(turn.startedAt) },
      { key: 'took', label: 'Time taken', kind: 'number', value: (turn) => turn.durationMs },
      { key: 'tokens', label: 'Tokens', kind: 'number', value: (turn) => turn.tokens.input + turn.tokens.output },
      { key: 'tools', label: 'Tool calls', kind: 'number', value: (turn) => turn.tools },
    ],
    views: [
      { id: 'all', name: 'All turns', filters: [] },
      { id: 'problems', name: 'Problems', filters: [{ key: 'health', values: ['problem'] }] },
      { id: 'feedback', name: 'With feedback', filters: [{ key: 'feedback', values: ['yes'] }] },
      { id: 'errors', name: 'Errors and limits', filters: [{ key: 'signal', values: ['failed', 'limit'] }] },
    ],
    defaultSort: { key: 'started', dir: 'desc' },
    searchText: (turn) => [turn.person, turn.project, turn.model, turn.id],
  };
}
