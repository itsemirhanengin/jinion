import { inviteStatus, listInvites, listUsers } from '@/lib/data';
import type { InviteRow } from '@/lib/lists/invites';

/** Every invite as the invites list shows it. */
export async function inviteRows(): Promise<InviteRow[]> {
  const [invites, users] = await Promise.all([listInvites(), listUsers()]);
  const names = new Map(users.map((user) => [user.id, user.name]));

  return invites.map((invite) => ({
    ...invite,
    status: inviteStatus(invite),
    joined: invite.usedBy.map((id) => ({ id, name: names.get(id) ?? id })),
  }));
}
