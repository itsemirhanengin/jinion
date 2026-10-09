import { NOW } from '@/lib/clock';
import type { Goal } from '@/lib/data/types';
import { DAY } from '@/lib/days';
import { type GoalStatus, metricOf } from '@/lib/metric-defs';

export interface TrackPoint {
  day: string;
  /** What the metric was that day, up to today. */
  actual?: number;
  /** Where it would be on a straight way from where the goal started to its target on the deadline. */
  path: number;
  /** Where it goes from today at the pace of the last week, up to the deadline. */
  projection?: number;
}

export interface GoalTrack {
  points: TrackPoint[];
  value: number;
  /** Where the metric lands on the deadline at the last week's pace; the value itself once the deadline passed. */
  projected: number;
  status: GoalStatus;
  daysLeft: number;
  /** The point that is today, for the chart's marker. */
  today: string;
}

// The pace comes from how much the metric moved over this many days, or fewer at the start.
const PACE_DAYS = 7;

/**
 * A goal's way from its start to its deadline, from the metric's daily values (oldest first): where it has been, where
 * it should be, and where it is heading. No data here, so a goal made in the browser can draw it too.
 */
export function trackGoal(goal: Goal, daily: { day: string; value: number }[]): GoalTrack {
  const metric = metricOf(goal.metric);
  const ceiling = metric.unit === 'percent' ? 100 : Number.POSITIVE_INFINITY;
  const deadline = Date.parse(goal.deadline);
  const ended = goal.deadline <= NOW;
  const actual = daily.filter((point) => Date.parse(point.day) >= Date.parse(goal.startsAt) - DAY && Date.parse(point.day) <= deadline);
  const first = actual[0] ?? { day: goal.startsAt, value: 0 };
  const last = actual.at(-1) ?? first;
  const span = Math.max(1, Math.round((deadline - Date.parse(first.day)) / DAY));
  const today = actual.length - 1;
  const back = Math.min(PACE_DAYS, today);
  const pace = back > 0 ? (last.value - actual[today - back]!.value) / back : 0;
  const clamp = (value: number) => Math.min(ceiling, Math.max(0, value));
  // Started past the target already, the way there is simply to stay at it.
  const ahead = metric.lowerIsBetter ? first.value <= goal.target : first.value >= goal.target;
  const from = ahead ? goal.target : first.value;

  const points: TrackPoint[] = Array.from({ length: span + 1 }, (_, index) => ({
    day: new Date(Date.parse(first.day) + index * DAY).toISOString(),
    actual: actual[index]?.value,
    path: from + ((goal.target - from) * index) / span,
    projection: !ended && index >= today ? clamp(last.value + pace * (index - today)) : undefined,
  }));

  const projected = ended ? last.value : (points.at(-1)?.projection ?? last.value);
  const meets = (value: number) => (metric.lowerIsBetter ? value <= goal.target : value >= goal.target);
  const status: GoalStatus = ended ? (meets(last.value) ? 'met' : 'missed') : meets(projected) ? 'on-track' : 'at-risk';

  return {
    points,
    value: last.value,
    projected,
    status,
    daysLeft: Math.max(0, Math.ceil((deadline - Date.parse(NOW)) / DAY)),
    today: points[Math.max(0, today)]?.day ?? first.day,
  };
}
