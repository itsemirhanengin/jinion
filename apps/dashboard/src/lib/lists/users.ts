import type { UserSummary } from '@/lib/data';
import type { ListConfig } from '@/lib/data-table';
import { BACKENDS, CLIENTS } from '@/lib/labels';

/** Quiet for this many days, a person counts as gone quiet. */
export const QUIET_DAYS = 3;

export const isQuiet = (user: UserSummary, now: string) =>
  !user.lastSeenAt || Date.parse(now) - Date.parse(user.lastSeenAt) > QUIET_DAYS * 24 * 60 * 60 * 1000;

export function usersList(now: string): ListConfig<UserSummary> {
  const quiet = (user: UserSummary) => isQuiet(user, now);

  return {
    filters: [
      {
        key: 'activity',
        label: 'Activity',
        options: [
          { value: 'active', label: 'Active' },
          { value: 'quiet', label: 'Gone quiet' },
        ],
        test: (user, value) => (value === 'quiet') === quiet(user),
      },
      {
        key: 'client',
        label: 'Client',
        multiple: true,
        options: Object.entries(CLIENTS).map(([value, label]) => ({ value, label })),
        test: (user, value) => user.clients.includes(value as UserSummary['clients'][number]),
      },
      {
        key: 'backend',
        label: 'Agent',
        multiple: true,
        options: BACKENDS.map((backend) => ({ value: backend, label: backend })),
        test: (user, value) => user.backends.includes(value as UserSummary['backends'][number]),
      },
    ],
    sortFields: [
      { key: 'seen', label: 'Last seen', kind: 'date', value: (user) => (user.lastSeenAt ? Date.parse(user.lastSeenAt) : null) },
      { key: 'joined', label: 'Joined', kind: 'date', value: (user) => Date.parse(user.joinedAt) },
      { key: 'turns', label: 'Turns this week', kind: 'number', value: (user) => user.turns7d },
      { key: 'problems', label: 'Problem rate', kind: 'number', value: (user) => user.problemRate },
    ],
    views: [
      { id: 'all', name: 'Everyone', filters: [] },
      { id: 'active', name: 'Active', filters: [{ key: 'activity', values: ['active'] }] },
      { id: 'quiet', name: 'Gone quiet', filters: [{ key: 'activity', values: ['quiet'] }] },
    ],
    defaultSort: { key: 'seen', dir: 'desc' },
    searchText: (user) => [user.name, user.email, user.invite],
  };
}
