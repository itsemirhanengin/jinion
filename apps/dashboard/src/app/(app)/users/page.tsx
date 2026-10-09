import { Suspense } from 'react';
import { PageSkeleton } from '@/components/page-skeleton';
import { PageTransition } from '@/components/page-transition';
import { UsersView } from '@/components/users/users-view';
import { listTurns, listUsers, NOW } from '@/lib/data';
import { figure } from '@/lib/metrics';

export default async function UsersPage() {
  const [users, turns] = await Promise.all([listUsers(), listTurns()]);

  const figures = (['active-users', 'retained', 'active-days', 'turns-per-day', 'problem-rate'] as const).map((id) => figure(id, turns, users));

  return (
    <PageTransition>
      <Suspense fallback={<PageSkeleton />}>
        <UsersView users={users} figures={figures} now={NOW} />
      </Suspense>
    </PageTransition>
  );
}
