'use client';

import { useState } from 'react';
import { CircleCheck } from 'lucide-react';
import { primaryButton, secondaryButton } from '@/components/data-table/buttons';
import { CopyButton, Reference } from '@/components/detail/parts';
import { SelectField, TextField } from '@/components/form/fields';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { NOW } from '@/lib/clock';
import { DAY } from '@/lib/days';
import { formatDate } from '@/lib/format';
import { type InviteRow, newInviteCode } from '@/lib/lists/invites';

const LIFETIMES = [
  { value: '7', label: 'In a week' },
  { value: '14', label: 'In two weeks' },
  { value: '30', label: 'In a month' },
  { value: 'never', label: 'Never' },
];

const USES = [
  { value: '1', label: 'One person' },
  { value: '3', label: 'Three people' },
  { value: '10', label: 'Ten people' },
];

/** Makes an invite: who it is for, how many can join with it and until when; then shows its code to send. */
export function NewInviteSheet({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (invite: InviteRow) => void }) {
  const [note, setNote] = useState('');
  const [uses, setUses] = useState('1');
  const [lifetime, setLifetime] = useState('14');
  const [created, setCreated] = useState<InviteRow | null>(null);

  function create() {
    const invite: InviteRow = {
      code: newInviteCode(),
      note: note.trim(),
      createdAt: NOW,
      expiresAt: lifetime === 'never' ? undefined : new Date(Date.parse(NOW) + Number(lifetime) * DAY).toISOString(),
      maxUses: Number(uses),
      usedBy: [],
      status: 'active',
      joined: [],
    };

    onCreate(invite);
    setCreated(invite);
  }

  function close() {
    onClose();
    setCreated(null);
    setNote('');
    setUses('1');
    setLifetime('14');
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && close()}>
      <SheetContent className="w-full gap-0 text-sm/5 sm:max-w-md sm:text-[0.8125rem]/5">
        <SheetHeader className="border-b border-neutral-950/8">
          <SheetTitle>New invite</SheetTitle>
          <SheetDescription>Only people with an invite can join the beta. Each code works as many times as you allow.</SheetDescription>
        </SheetHeader>
        {created ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <CircleCheck className="size-8 stroke-green-600" />
            <p className="font-medium">The invite for {created.note} is ready</p>
            <p className="flex items-center gap-1 text-base/6">
              <Reference>{created.code}</Reference>
              <CopyButton value={created.code} label="Copy the code" />
            </p>
            <p className="text-neutral-500">
              {created.maxUses === 1 ? 'One person' : `${created.maxUses} people`} can join with it
              {created.expiresAt ? ` until ${formatDate(created.expiresAt)}` : ''}.
            </p>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-5 p-4">
            <TextField label="Who is it for" placeholder="Ece, from the design team" value={note} onChange={(event) => setNote(event.target.value)} />
            <SelectField label="Who can use it" options={USES} value={uses} onChange={setUses} />
            <SelectField label="Expires" description="An unused invite stops working after this." options={LIFETIMES} value={lifetime} onChange={setLifetime} />
          </div>
        )}
        <SheetFooter className="flex-row items-center justify-end gap-2 border-t border-neutral-950/8">
          {created ? (
            <button type="button" onClick={close} className={`px-2.5 py-1 ${primaryButton}`}>
              Done
            </button>
          ) : (
            <>
              <button type="button" onClick={close} className={`px-2.5 py-1 ${secondaryButton}`}>
                Cancel
              </button>
              <button type="button" disabled={!note.trim()} onClick={create} className={`px-2.5 py-1 ${primaryButton}`}>
                Create invite
              </button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
