'use client';

import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { Reference } from '@/components/detail/parts';
import { type Stat, StatStrip } from '@/components/detail/stat-strip';
import { none } from '@/components/empty-value';
import type { UserSummary } from '@/lib/data';
import type { Column } from '@/lib/data-table';
import { formatAgo, formatPercent, formatShortDate } from '@/lib/format';
import { CLIENTS } from '@/lib/labels';
import { usersList } from '@/lib/lists/users';

const columns: Column<UserSummary>[] = [
  { key: 'invite', label: 'Invite', render: (user) => <Reference>{user.invite}</Reference> },
  { key: 'joined', label: 'Joined', render: (user) => formatShortDate(user.joinedAt) },
  { key: 'seen', label: 'Last seen', render: (user) => (user.lastSeenAt ? formatAgo(user.lastSeenAt) : none) },
  { key: 'turns', label: 'Turns this week', align: 'right', render: (user) => user.turns7d },
  { key: 'days', label: 'Active days', align: 'right', render: (user) => `${user.activeDays7d} / 7` },
  { key: 'problems', label: 'Problem rate', align: 'right', render: (user) => (user.problemRate === null ? none : formatPercent(user.problemRate)) },
  { key: 'clients', label: 'Client', render: (user) => user.clients.map((client) => CLIENTS[client]).join(' · ') || none },
  { key: 'backends', label: 'Agent', render: (user) => user.backends.join(' · ') || none },
  { key: 'version', label: 'Version', render: (user) => user.version },
];

export function UsersView({ users, figures, now }: { users: UserSummary[]; figures: Stat[]; now: string }) {
  const list = useMemo(() => usersList(now), [now]);

  return (
    <DataTable
      title="Users"
      icon={Users}
      unit={['person', 'people']}
      rows={users}
      getRowId={(user) => user.id}
      primary={{ label: 'Name', text: (user) => user.name, href: (user) => `/users/${user.id}` }}
      columns={columns}
      defaultVisible={['invite', 'seen', 'turns', 'days', 'problems', 'clients', 'backends']}
      list={list}
      insights={() => <StatStrip stats={figures} />}
      search={{ label: 'Search users', placeholder: 'Search by name, email or invite' }}
      emptyText="No one matches these filters."
    />
  );
}
