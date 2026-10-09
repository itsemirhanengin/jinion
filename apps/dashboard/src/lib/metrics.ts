import { BETA_START, NOW } from '@/lib/clock';
import type { MetricId, Turn, User } from '@/lib/data';
import { DAY, dayOf, endOfDay, weekStart } from '@/lib/days';
import { formatMetric, metricOf } from '@/lib/metric-defs';
import { hasProblem } from '@/lib/problems';

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
  return daily((at) => measure(id, turns, users, at), until).slice(metricOf(id).measurableAfterDays ?? 0);
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

// A person is either active or not, so for metrics about the group a person's own share of it is their active days.
const PERSONAL: Partial<Record<MetricId, MetricId>> = { 'active-users': 'active-days', retained: 'active-days' };

// A share or an average of turns has no value for someone who ran none.
const OF_TURNS: MetricId[] = ['success-rate', 'problem-rate', 'turns-per-day'];

/**
 * Each person's own value of the metric, or the closest personal one, over the 7 days before `at`; for a metric of
 * turns, those who ran none that week apart, as `idle`.
 */
export function byPerson(id: MetricId, turns: Turn[], users: User[], at = Date.parse(NOW)) {
  const metric = metricOf(PERSONAL[id] ?? id);
  const ranTurns = (user: User) => lastWeek(turns, at).some((turn) => turn.user === user.id);
  const counted = OF_TURNS.includes(metric.id) ? users.filter(ranTurns) : users;

  return {
    metric,
    people: counted.map((user) => ({ name: user.name, value: measure(metric.id, turns.filter((turn) => turn.user === user.id), [user], at) })),
    idle: users.filter((user) => !counted.includes(user)).map((user) => user.name),
  };
}

/** Each day's turns, split by whether they went well, and how many people ran one. */
export function dayByDay(turns: Turn[], until = Date.parse(NOW)) {
  const days = new Map<string, { clean: number; problem: number; people: Set<string> }>();

  for (const turn of turns) {
    if (Date.parse(turn.startedAt) >= until) continue;

    const day = dayOf(turn.startedAt);
    const entry = days.get(day) ?? { clean: 0, problem: 0, people: new Set<string>() };

    if (hasProblem(turn)) entry.problem++;
    else entry.clean++;

    entry.people.add(turn.user);
    days.set(day, entry);
  }

  return [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, entry]) => ({ day: `${day}T12:00:00.000Z`, clean: entry.clean, problem: entry.problem, people: entry.people.size }));
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
export function lastWeek(turns: Turn[], at: number) {
  const from = weekStart(at);

  return turns.filter((turn) => {
    const time = Date.parse(turn.startedAt);

    return time < at && time >= from;
  });
}
