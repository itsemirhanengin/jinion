import { Suspense } from 'react';
import { PageSkeleton } from '@/components/page-skeleton';
import { PageTransition } from '@/components/page-transition';
import { TurnsView } from '@/components/turns/turns-view';
import { formatCompact, formatDuration } from '@/lib/format';
import { figure, weeklyFigure } from '@/lib/metrics';
import { turnRows } from '@/lib/turn-rows';

export default async function TurnsPage() {
  const { rows, turns, users } = await turnRows();
  const average = (week: typeof turns, value: (turn: (typeof turns)[number]) => number) => (week.length ? week.reduce((sum, turn) => sum + value(turn), 0) / week.length : 0);

  const figures = [
    weeklyFigure('Turns this week', 'Turns everyone ran in the last 7 days.', turns, (week) => week.length, (value) => value.toLocaleString('en-US')),
    figure('success-rate', turns, users),
    figure('problem-rate', turns, users),
    weeklyFigure('Time a turn takes', 'From the message to the reply, on average, over the last 7 days.', turns, (week) => average(week, (turn) => turn.durationMs), formatDuration),
    weeklyFigure(
      'Tokens a turn',
      'Input and output tokens per turn, on average, over the last 7 days.',
      turns,
      (week) => average(week, (turn) => turn.tokens.input + turn.tokens.output),
      formatCompact,
    ),
  ];

  return (
    <PageTransition>
      <Suspense fallback={<PageSkeleton />}>
        <TurnsView rows={rows} users={users.map(({ id, name }) => ({ id, name }))} figures={figures} />
      </Suspense>
    </PageTransition>
  );
}
