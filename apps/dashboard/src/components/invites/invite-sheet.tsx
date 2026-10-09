'use client';

import Link from 'next/link';
import { secondaryButton } from '@/components/data-table/buttons';
import { CopyButton, Facts, Reference, SideSection } from '@/components/detail/parts';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDate, formatStamp } from '@/lib/format';
import { INVITE_STATUSES } from '@/lib/labels';
import type { InviteRow } from '@/lib/lists/invites';

/** One invite: its code to copy, who it is for, who joined with it, and the way to revoke it while it still works. */
export function InviteSheet({ invite, onClose, onRevoke }: { invite: InviteRow | null; onClose: () => void; onRevoke: (code: string) => void }) {
  return (
    <Sheet open={invite !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 text-sm/5 sm:max-w-md sm:text-[0.8125rem]/5">
        {invite && (
          <>
            <SheetHeader className="border-b border-neutral-950/8">
              <SheetTitle className="flex items-center gap-2">
                <Reference>{invite.code}</Reference>
                <CopyButton value={invite.code} label="Copy the code" />
                <StatusBadge tone={INVITE_STATUSES[invite.status].tone}>{INVITE_STATUSES[invite.status].label}</StatusBadge>
              </SheetTitle>
              <SheetDescription>For {invite.note}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
              <SideSection title="Invite">
                <Facts
                  rows={[
                    { label: 'Uses', value: `${invite.usedBy.length} of ${invite.maxUses}` },
                    { label: 'Created', value: formatStamp(invite.createdAt) },
                    { label: 'Expires', value: invite.expiresAt ? formatDate(invite.expiresAt) : 'Never' },
                    ...(invite.revokedAt ? [{ label: 'Revoked', value: formatStamp(invite.revokedAt) }] : []),
                  ]}
                />
              </SideSection>
              <SideSection title="Joined with it">
                {invite.joined.length === 0 ? (
                  <p className="text-neutral-500">No one yet.</p>
                ) : (
                  <ul role="list" className="flex flex-col gap-1">
                    {invite.joined.map((user) => (
                      <li key={user.id}>
                        <Link href={`/users/${user.id}`} className="underline decoration-neutral-950/20 underline-offset-2 hover:decoration-neutral-950">
                          {user.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </SideSection>
            </div>
            {invite.status === 'active' && (
              <SheetFooter className="flex-row items-center border-t border-neutral-950/8">
                <p className="mr-auto text-neutral-500">Revoking stops the code from working; anyone who joined with it stays.</p>
                <button type="button" onClick={() => onRevoke(invite.code)} className={`px-2.5 py-1 text-red-700 ${secondaryButton}`}>
                  Revoke
                </button>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
