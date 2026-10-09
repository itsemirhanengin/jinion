import { BETA_START, NOW } from '@/lib/clock';
import type { MetricId, Turn, User } from '@/lib/data';
import { DAY, dayOf, endOfDay, startOfDay, weekStart } from '@/lib/days';
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

/**
 * For each day from the beta's start: who ran a turn that day (DAU), in the 7 days to it (WAU) and in the 30 days to
 * it (MAU), and how many turns ran that day.
 */
export function activeUsers(turns: Turn[], until = Date.parse(NOW)) {
  const byDay = new Map<string, { people: Set<string>; turns: number }>();

  for (const turn of turns) {
    const day = dayOf(turn.startedAt);
    const entry = byDay.get(day) ?? { people: new Set<string>(), turns: 0 };

    entry.people.add(turn.user);
    entry.turns++;
    byDay.set(day, entry);
  }

  const days: string[] = [];

  for (let at = startOfDay(Date.parse(BETA_START)); at < until; at += DAY) days.push(dayOf(new Date(at + 1).toISOString()));

  const within = (index: number, length: number) => new Set(days.slice(Math.max(0, index - length + 1), index + 1).flatMap((day) => [...(byDay.get(day)?.people ?? [])])).size;

  return days.map((day, index) => ({
    day: `${day}T12:00:00.000Z`,
    dau: byDay.get(day)?.people.size ?? 0,
    wau: within(index, 7),
    mau: within(index, 30),
    turns: byDay.get(day)?.turns ?? 0,
  }));
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
