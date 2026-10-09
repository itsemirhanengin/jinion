import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { GoalDetailView } from '@/components/goals/goal-detail-view';
import { PageSkeleton } from '@/components/page-skeleton';
import { PageTransition } from '@/components/page-transition';
import { NOW } from '@/lib/clock';
import { listGoals, listTurns, listUsers } from '@/lib/data';
import { trackGoal } from '@/lib/goal-track';
import { byPerson, dayByDay, series } from '@/lib/metrics';

export default function GoalPage(props: PageProps<'/goals/[id]'>) {
  return (
    <PageTransition>
      <Suspense fallback={<PageSkeleton variant="detail" />}>
        <GoalDetail {...props} />
      </Suspense>
    </PageTransition>
  );
}

async function GoalDetail({ params }: PageProps<'/goals/[id]'>) {
  const { id } = await params;
  const [goals, turns, users] = await Promise.all([listGoals(), listTurns(), listUsers()]);
  const index = goals.findIndex((goal) => goal.id === id);
  const goal = goals[index];

  if (!goal) notFound();

  const until = Math.min(Date.parse(goal.deadline), Date.parse(NOW));

  const nav = {
    backHref: '/goals',
    prevHref: index > 0 ? `/goals/${goals[index - 1]!.id}` : null,
    nextHref: index < goals.length - 1 ? `/goals/${goals[index + 1]!.id}` : null,
    position: index + 1,
    total: goals.length,
  };

  return (
    <GoalDetailView
      goal={goal}
      track={trackGoal(goal, series(goal.metric, turns, users, until))}
      people={byPerson(goal.metric, turns, users, until)}
      days={dayByDay(turns, until)}
      nav={nav}
    />
  );
}
