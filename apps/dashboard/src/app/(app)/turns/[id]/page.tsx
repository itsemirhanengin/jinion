import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { PageSkeleton } from '@/components/page-skeleton';
import { PageTransition } from '@/components/page-transition';
import { TurnDetailView } from '@/components/turns/turn-detail-view';
import { getTurn, listFeedback } from '@/lib/data';
import { neighborsOf, parseListState, serializeListState } from '@/lib/data-table';
import { turnsList } from '@/lib/lists/turns';
import { turnRows } from '@/lib/turn-rows';

export default function TurnPage(props: PageProps<'/turns/[id]'>) {
  return (
    <PageTransition>
      <Suspense fallback={<PageSkeleton variant="detail" />}>
        <TurnDetail {...props} />
      </Suspense>
    </PageTransition>
  );
}

async function TurnDetail({ params, searchParams }: PageProps<'/turns/[id]'>) {
  const { id } = await params;
  const search = await searchParams;
  const [turn, { rows, users }, feedback] = await Promise.all([getTurn(id), turnRows(), listFeedback()]);

  if (!turn) notFound();

  const list = turnsList(users);
  const state = parseListState(search, list);
  const neighbors = neighborsOf(rows, id, state, list, (row) => row.id);
  const query = serializeListState(state, list);
  const withQuery = (path: string) => (query ? `${path}?${query}` : path);

  const nav = {
    backHref: withQuery('/turns'),
    prevHref: neighbors.prevId && withQuery(`/turns/${neighbors.prevId}`),
    nextHref: neighbors.nextId && withQuery(`/turns/${neighbors.nextId}`),
    position: neighbors.position,
    total: neighbors.total,
  };

  const session = rows.filter((row) => row.session === turn.session).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const person = users.find((user) => user.id === turn.user)!;

  return (
    <TurnDetailView
      turn={turn}
      person={{ id: person.id, name: person.name }}
      session={session.map(({ id: turnId, startedAt, outcome }) => ({ id: turnId, startedAt, outcome }))}
      feedback={feedback.filter((item) => item.turn === id)}
      nav={nav}
    />
  );
}
