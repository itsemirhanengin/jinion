import type { Invite, InviteStatus } from '@/lib/data';
import type { ListConfig } from '@/lib/data-table';
import { INVITE_STATUSES } from '@/lib/labels';

/** An invite as its list shows it: its status, and the names of those who joined with it. */
export interface InviteRow extends Invite {
  status: InviteStatus;
  joined: { id: string; name: string }[];
}

export const invitesList: ListConfig<InviteRow> = {
  filters: [
    {
      key: 'status',
      label: 'Status',
      multiple: true,
      options: Object.entries(INVITE_STATUSES).map(([value, status]) => ({ value, label: status.label })),
      test: (invite, value) => invite.status === value,
    },
  ],
  sortFields: [
    { key: 'created', label: 'Created', kind: 'date', value: (invite) => Date.parse(invite.createdAt) },
    { key: 'expires', label: 'Expires', kind: 'date', value: (invite) => (invite.expiresAt ? Date.parse(invite.expiresAt) : null) },
    { key: 'uses', label: 'Uses', kind: 'number', value: (invite) => invite.usedBy.length },
  ],
  views: [
    { id: 'all', name: 'All invites', filters: [] },
    { id: 'active', name: 'Waiting', filters: [{ key: 'status', values: ['active'] }] },
    { id: 'used', name: 'Used', filters: [{ key: 'status', values: ['used'] }] },
    { id: 'closed', name: 'Expired or revoked', filters: [{ key: 'status', values: ['expired', 'revoked'] }] },
  ],
  defaultSort: { key: 'created', dir: 'desc' },
  searchText: (invite) => [invite.code, invite.note, ...invite.joined.map((user) => user.name)],
};

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** A code like JN-7Q4K-2M9X, without the characters people mix up (0 and O, 1 and I). */
export function newInviteCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const characters = [...bytes].map((byte) => ALPHABET[byte % ALPHABET.length]).join('');

  return `JN-${characters.slice(0, 4)}-${characters.slice(4)}`;
}
