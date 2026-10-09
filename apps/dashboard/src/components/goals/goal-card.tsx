import Link from 'next/link';
import { GoalChart } from '@/components/charts/goal-chart';
import { card } from '@/components/data-table/buttons';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatShortDate } from '@/lib/format';
import type { GoalCard as Card } from '@/lib/goal-cards';
import type { GoalTrack } from '@/lib/goal-track';
import { GOAL_STATUSES } from '@/lib/labels';
import { formatMetric, type Metric, metricOf } from '@/lib/metric-defs';

/** A goal as its chart: where it is, where it should be by the deadline, and where it is heading. */
export function GoalCard({ goal, track, saved }: Card & { saved: boolean }) {
  const metric = metricOf(goal.metric);
  const format = (value: number) => formatMetric(value, metric.unit);

  return (
    <article className={`${card} relative flex flex-col gap-3 p-4 ${saved ? 'hover:ring-neutral-950/15' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-medium">
            {/* A goal made on this page has no page of its own until the API keeps it. */}
            {saved ? (
              <Link transitionTypes={['nav-forward']} href={`/goals/${goal.id}`} className="after:absolute after:inset-0">
                {goal.name}
              </Link>
            ) : (
              goal.name
            )}
          </h2>
          <p className="text-neutral-500">{metric.label}</p>
        </div>
        <StatusBadge tone={GOAL_STATUSES[track.status].tone}>{GOAL_STATUSES[track.status].label}</StatusBadge>
      </div>

      <GoalChart track={track} target={goal.target} format={format} percent={metric.unit === 'percent'} compact />

      <GoalSentence goal={goal} metric={metric} track={track} format={format} />
    </article>
  );
}

/** The chart in one line: where the metric is, what it has to be by when, and where this pace takes it. */
export function GoalSentence({ goal, metric, track, format }: { goal: Card['goal']; metric: Metric; track: GoalTrack; format: (value: number) => string }) {
  const needs = `${metric.lowerIsBetter ? 'at most' : 'at least'} ${format(goal.target)}`;
  const reaches = track.status === 'on-track' || track.status === 'met';

  if (track.status === 'met' || track.status === 'missed') {
    return (
      <p className="text-neutral-600">
        Ended at <span className="font-medium text-neutral-950 tabular-nums">{format(track.value)}</span> on {formatShortDate(goal.deadline)}, against {needs}.
      </p>
    );
  }

  return (
    <p className="text-neutral-600">
      <span className="font-medium text-neutral-950 tabular-nums">{format(track.value)}</span> now · needs {needs} by {formatShortDate(goal.deadline)} · at this pace{' '}
      <span className={`font-medium tabular-nums ${reaches ? 'text-green-700' : 'text-amber-700'}`}>{format(track.projected)}</span>
    </p>
  );
}
