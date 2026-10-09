import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';
import type { GoalCard } from '@/lib/goal-cards';
import { GOAL_STATUSES } from '@/lib/labels';
import { formatMetric, metricOf } from '@/lib/metric-defs';

const FILL: Record<GoalCard['track']['status'], string> = {
  'on-track': 'bg-sky-500',
  'at-risk': 'bg-amber-400',
  met: 'bg-green-500',
  missed: 'bg-red-400',
};

/** Each goal as a bar of where its metric is, with a mark where the target sits on the same scale. */
export function GoalBars({ goals }: { goals: GoalCard[] }) {
  if (goals.length === 0) return <p className="py-6 text-center text-neutral-500">No goals yet.</p>;

  return (
    <ul role="list" className="flex flex-col gap-4">
      {goals.map(({ goal, track }) => {
        const metric = metricOf(goal.metric);
        const scale = metric.unit === 'percent' ? 100 : Math.max(goal.target, track.value) * 1.25;

        return (
          <li key={goal.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <Link href={`/goals/${goal.id}`} className="min-w-0 truncate hover:underline">
                {goal.name}
              </Link>
              <StatusBadge tone={GOAL_STATUSES[track.status].tone}>{GOAL_STATUSES[track.status].label}</StatusBadge>
            </div>
            <div className="relative h-2 rounded-full bg-neutral-950/6">
              <div className={`h-full rounded-full ${FILL[track.status]}`} style={{ width: `${Math.min(100, (track.value / scale) * 100)}%` }} />
              <span
                aria-hidden="true"
                className="absolute -top-1 h-4 w-0.5 rounded-full bg-neutral-950"
                style={{ left: `calc(${Math.min(100, (goal.target / scale) * 100)}% - 1px)` }}
              />
            </div>
            <p className="text-xs/5 text-neutral-500 tabular-nums">
              {formatMetric(track.value, metric.unit)} now · target {metric.lowerIsBetter ? '≤' : '≥'} {formatMetric(goal.target, metric.unit)} ·{' '}
              {track.daysLeft > 0 ? `${track.daysLeft} ${track.daysLeft === 1 ? 'day' : 'days'} left` : 'ended'}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
