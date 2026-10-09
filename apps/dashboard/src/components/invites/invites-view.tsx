'use client';

import { useState } from 'react';
import { Plus, Ticket } from 'lucide-react';
import { DataTable } from '@/components/data-table/data-table';
import { Reference } from '@/components/detail/parts';
import { StatStrip } from '@/components/detail/stat-strip';
import { none } from '@/components/empty-value';
import { InviteSheet } from '@/components/invites/invite-sheet';
import { NewInviteSheet } from '@/components/invites/new-invite-sheet';
import { StatusBadge } from '@/components/ui/status-badge';
import { NOW } from '@/lib/data';
import type { Column } from '@/lib/data-table';
import { formatPercent, formatShortDate } from '@/lib/format';
import { INVITE_STATUSES } from '@/lib/labels';
import { type InviteRow, invitesList } from '@/lib/lists/invites';

const columns: Column<InviteRow>[] = [
  { key: 'note', label: 'For', render: (invite) => invite.note },
  { key: 'status', label: 'Status', render: (invite) => <StatusBadge tone={INVITE_STATUSES[invite.status].tone}>{INVITE_STATUSES[invite.status].label}</StatusBadge> },
  { key: 'uses', label: 'Uses', align: 'right', render: (invite) => `${invite.usedBy.length} / ${invite.maxUses}` },
  { key: 'joined', label: 'Joined with it', render: (invite) => invite.joined.map((user) => user.name).join(', ') || none },
  { key: 'created', label: 'Created', render: (invite) => formatShortDate(invite.createdAt) },
  { key: 'expires', label: 'Expires', render: (invite) => (invite.expiresAt ? formatShortDate(invite.expiresAt) : 'Never') },
];

export function InvitesView({ invites: initial }: { invites: InviteRow[] }) {
  // New and revoked invites stay on this page only, until the API keeps them.
  const [invites, setInvites] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const sent = invites.filter((invite) => invite.status !== 'revoked');
  const joined = sent.reduce((sum, invite) => sum + invite.usedBy.length, 0);
  const seats = sent.reduce((sum, invite) => sum + invite.maxUses, 0);

  function revoke(code: string) {
    setInvites((all) => all.map((invite) => (invite.code === code ? { ...invite, status: 'revoked', revokedAt: NOW } : invite)));
  }

  return (
    <>
      <DataTable
        title="Invites"
        icon={Ticket}
        unit={['invite', 'invites']}
        actions={[{ label: 'New invite', icon: Plus, primary: true, onClick: () => setCreating(true) }]}
        rows={invites}
        getRowId={(invite) => invite.code}
        primary={{ label: 'Code', text: (invite) => <Reference>{invite.code}</Reference>, onSelect: (invite) => setOpen(invite.code) }}
        columns={columns}
        defaultVisible={['note', 'status', 'uses', 'joined', 'created', 'expires']}
        list={invitesList}
        insights={() => (
          <StatStrip
            stats={[
              { label: 'Waiting', value: invites.filter((invite) => invite.status === 'active').length, hint: 'Invites that still work and have room left.' },
              { label: 'Joined', value: joined, hint: 'People who joined with an invite.' },
              { label: 'Taken up', value: formatPercent(seats ? joined / seats : 0), hint: 'Of the places the invites sent so far offer, the share someone took.' },
              { label: 'Expired unused', value: invites.filter((invite) => invite.status === 'expired').length, hint: 'Invites that ran out before anyone used them.' },
            ]}
          />
        )}
        search={{ label: 'Search invites', placeholder: 'Search by code, person or note' }}
        emptyText="No invite matches these filters."
      />
      <NewInviteSheet open={creating} onClose={() => setCreating(false)} onCreate={(invite) => setInvites((all) => [invite, ...all])} />
      <InviteSheet invite={invites.find((invite) => invite.code === open) ?? null} onClose={() => setOpen(null)} onRevoke={revoke} />
    </>
  );
}
