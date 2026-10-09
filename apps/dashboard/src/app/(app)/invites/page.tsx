import { Suspense } from 'react';
import { InvitesView } from '@/components/invites/invites-view';
import { PageSkeleton } from '@/components/page-skeleton';
import { PageTransition } from '@/components/page-transition';
import { inviteRows } from '@/lib/invite-rows';

export default async function InvitesPage() {
  const invites = await inviteRows();

  return (
    <PageTransition>
      <Suspense fallback={<PageSkeleton />}>
        <InvitesView invites={invites} />
      </Suspense>
    </PageTransition>
  );
}
