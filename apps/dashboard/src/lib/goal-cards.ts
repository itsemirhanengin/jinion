import { type Goal, listGoals, listTurns, listUsers, type MetricId } from '@/lib/data';
import { type GoalTrack, trackGoal } from '@/lib/goal-track';
import { METRICS } from '@/lib/metric-defs';
import { series } from '@/lib/metrics';

export interface GoalCard {
  goal: Goal;
  track: GoalTrack;
}

/** Every goal with its track, and each metric's days so far, so a goal made on the page can draw its own. */
export async function goalCards() {
  const [goals, turns, users] = await Promise.all([listGoals(), listTurns(), listUsers()]);

  const daily = Object.fromEntries(METRICS.map((metric) => [metric.id, series(metric.id, turns, users)])) as Record<
    MetricId,
    { day: string; value: number }[]
  >;

  return { cards: goals.map((goal): GoalCard => ({ goal, track: trackGoal(goal, daily[goal.metric]) })), daily };
}
