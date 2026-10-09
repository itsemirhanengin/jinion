import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { PageSkeleton } from '@/components/page-skeleton';
import { PageTransition } from '@/components/page-transition';
import { UserDetailView } from '@/components/users/user-detail-view';
import { activityByDay, projectsOf, tokensOf } from '@/lib/activity';
import { NOW } from '@/lib/clock';
import { getUser, listFeedback, listTurns, listUsers } from '@/lib/data';
import { neighborsOf, parseListState, serializeListState } from '@/lib/data-table';
import { weekStart } from '@/lib/days';
import { isQuiet, usersList } from '@/lib/lists/users';
import { figure } from '@/lib/metrics';

export default function UserPage(props: PageProps<'/users/[id]'>) {
  return (
    <PageTransition>
      <Suspense fallback={<PageSkeleton variant="detail" />}>
        <UserDetail {...props} />
      </Suspense>
    </PageTransition>
  );
}

async function UserDetail({ params, searchParams }: PageProps<'/users/[id]'>) {
  const { id } = await params;
  const search = await searchParams;
  const [user, users, turns, feedback] = await Promise.all([getUser(id), listUsers(), listTurns({ user: id }), listFeedback({ user: id })]);

  if (!user) notFound();

  const list = usersList(NOW);
  const state = parseListState(search, list);
  const neighbors = neighborsOf(users, id, state, list, (row) => row.id);
  const query = serializeListState(state, list);
  const withQuery = (path: string) => (query ? `${path}?${query}` : path);

  const nav = {
    backHref: withQuery('/users'),
    prevHref: neighbors.prevId && withQuery(`/users/${neighbors.prevId}`),
    nextHref: neighbors.nextId && withQuery(`/users/${neighbors.nextId}`),
    position: neighbors.position,
    total: neighbors.total,
  };

  const figures = (['active-days', 'turns-per-day', 'problem-rate'] as const).map((metric) => figure(metric, turns, [user]));
  const lastWeek = turns.filter((turn) => Date.parse(turn.startedAt) >= weekStart(Date.parse(NOW)));

  return (
    <UserDetailView
      user={user}
      days={activityByDay(turns)}
      recent={turns.slice(0, 50)}
      turnCount={turns.length}
      projects={projectsOf(turns).slice(0, 6)}
      tokens={tokensOf(lastWeek)}
      feedback={feedback}
      figures={figures}
      nav={nav}
      quiet={isQuiet(user, NOW)}
    />
  );
}
