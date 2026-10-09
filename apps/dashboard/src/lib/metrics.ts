import { BETA_START, type Goal, hasProblem, type MetricId, NOW, type Turn, type User } from '@/lib/data';
import { DAY, dayOf, endOfDay, weekStart } from '@/lib/days';

export type Unit = 'users' | 'percent' | 'days' | 'turns';

export interface Metric {
  id: MetricId;
  label: string;
  description: string;
  unit: Unit;
  /** Whether a lower value is the better one. */
  lowerIsBetter?: boolean;
}

export const METRICS: Metric[] = [
  { id: 'active-users', label: 'Active users', description: 'People who ran at least one turn in the last 7 days.', unit: 'users' },
  {
    id: 'retained',
    label: 'Still using it',
    description: 'Of the people who joined a week or more ago, the share who ran a turn in the last 7 days.',
    unit: 'percent',
  },
  {
    id: 'active-days',
    label: 'Active days a week',
    description: 'On how many of the last 7 days each person ran a turn, on average.',
    unit: 'days',
  },
  { id: 'success-rate', label: 'Turns that went well', description: 'Turns in the last 7 days with no sign of a problem.', unit: 'percent' },
  {
    id: 'problem-rate',
    label: 'Turns with a problem',
    description: 'Turns in the last 7 days with a sign of a problem: an error, an interruption, a correction, a dislike…',
    unit: 'percent',
    lowerIsBetter: true,
  },
  {
    id: 'turns-per-day',
    label: 'Turns a day',
    description: 'Turns per person on the days they used Jinion, over the last 7 days.',
    unit: 'turns',
  },
];

export const metricOf = (id: MetricId) => METRICS.find((metric) => metric.id === id)!;

/** The metric over the 7 days before `at`. */
export function measure(id: MetricId, turns: Turn[], users: User[], at: number): number {
  const from = weekStart(at);
  const window = lastWeek(turns, at);
  const active = new Set(window.map((turn) => turn.user));
  const settled = users.filter((user) => Date.parse(user.joinedAt) <= from);
  const joined = users.filter((user) => Date.parse(user.joinedAt) <= at);
  const days = (userId: string) => new Set(window.filter((turn) => turn.user === userId).map((turn) => dayOf(turn.startedAt))).size;
  const share = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0);

  switch (id) {
    case 'active-users':
      return active.size;

    case 'retained':
      return share(settled.filter((user) => active.has(user.id)).length, settled.length);

    case 'active-days':
      return joined.length ? joined.reduce((sum, user) => sum + days(user.id), 0) / joined.length : 0;

    case 'success-rate':
      return share(window.filter((turn) => !hasProblem(turn)).length, window.length);

    case 'problem-rate':
      return share(window.filter(hasProblem).length, window.length);

    case 'turns-per-day': {
      const activeDays = [...active].reduce((sum, userId) => sum + days(userId), 0);

      return activeDays ? window.length / activeDays : 0;
    }
  }
}

/** The metric at the end of each day from the beta's start to `until`, as a chart draws it. */
export function series(id: MetricId, turns: Turn[], users: User[], until = Date.parse(NOW)) {
  return daily((at) => measure(id, turns, users, at), until);
}

/** A metric as a strip of figures shows it: its value now, its change over a week, and both weeks' days. */
export function figure(id: MetricId, turns: Turn[], users: User[]) {
  const metric = metricOf(id);

  return figureOf(metric.label, metric.description, series(id, turns, users), (value) => formatMetric(value, metric.unit));
}

/** A figure for a value of a week's turns that isn't one of the metrics, e.g. how long they took on average. */
export function weeklyFigure(label: string, hint: string, turns: Turn[], value: (week: Turn[]) => number, format: (value: number) => string) {
  return figureOf(label, hint, daily((at) => value(lastWeek(turns, at))), format);
}

function figureOf(label: string, hint: string, series: { value: number }[], format: (value: number) => string) {
  const points = series.map((point) => point.value);
  const value = points.at(-1) ?? 0;
  const weekBefore = points.at(-8);

  return {
    label,
    hint,
    value: format(value),
    change: weekBefore ? ((value - weekBefore) / weekBefore) * 100 : null,
    trend: { current: points.slice(-7), previous: points.slice(-14, -7) },
  };
}

/** A value at the end of each day from the beta's start to `until`. */
function daily(value: (at: number) => number, until = Date.parse(NOW)) {
  const points: { day: string; value: number }[] = [];

  for (let end = endOfDay(Date.parse(BETA_START)); end - DAY < until; end += DAY) {
    const at = Math.min(end, until);

    points.push({ day: new Date(at - 1).toISOString(), value: value(at) });
  }

  return points;
}

/** The turns of the 7 days before `at`. */
function lastWeek(turns: Turn[], at: number) {
  const from = weekStart(at);

  return turns.filter((turn) => {
    const time = Date.parse(turn.startedAt);

    return time < at && time >= from;
  });
}

export type GoalStatus = 'on-track' | 'at-risk' | 'met' | 'missed';

export function goalProgress(goal: Goal, turns: Turn[], users: User[]) {
  const metric = metricOf(goal.metric);
  const ended = goal.deadline <= NOW;
  const value = measure(goal.metric, turns, users, Math.min(Date.parse(goal.deadline), Date.parse(NOW)));
  const meets = metric.lowerIsBetter ? value <= goal.target : value >= goal.target;
  const progress = metric.lowerIsBetter ? (value ? Math.min(1, goal.target / value) : 1) : Math.min(1, value / goal.target);
  const status: GoalStatus = ended ? (meets ? 'met' : 'missed') : meets ? 'on-track' : 'at-risk';

  return { metric, value, progress, status, daysLeft: Math.max(0, Math.ceil((Date.parse(goal.deadline) - Date.parse(NOW)) / DAY)) };
}

export function formatMetric(value: number, unit: Unit) {
  switch (unit) {
    case 'percent':
      return `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
    case 'days':
      return value.toLocaleString('en-US', { maximumFractionDigits: 1 });
    case 'users':
    case 'turns':
      return value.toLocaleString('en-US', { maximumFractionDigits: unit === 'turns' ? 1 : 0 });
  }
}

