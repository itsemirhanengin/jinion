import { hasProblem, isProblem, type Signal, type Turn } from '@/lib/data';
import { dayOf } from '@/lib/days';

export interface DayActivity {
  day: string;
  /** The last turn of the day, where its item sits in a timeline. */
  lastAt: string;
  turns: number;
  problems: number;
  projects: string[];
  signals: [Signal, number][];
}

/** A person's turns, a day at a time, newest first. */
export function activityByDay(turns: Turn[]): DayActivity[] {
  const days = new Map<string, Turn[]>();

  for (const turn of turns) {
    const day = dayOf(turn.startedAt);

    days.set(day, [...(days.get(day) ?? []), turn]);
  }

  return [...days].map(([day, ofDay]) => {
    const counts = new Map<Signal, number>();

    for (const signal of ofDay.flatMap((turn) => turn.signals).filter(isProblem)) counts.set(signal, (counts.get(signal) ?? 0) + 1);

    return {
      day,
      lastAt: ofDay.reduce((latest, turn) => (turn.startedAt > latest ? turn.startedAt : latest), ofDay[0]!.startedAt),
      turns: ofDay.length,
      problems: ofDay.filter(hasProblem).length,
      projects: [...new Set(ofDay.map((turn) => turn.project))],
      signals: [...counts].sort((a, b) => b[1] - a[1]),
    };
  });
}

/** Projects by how many turns ran in them, most first. */
export function projectsOf(turns: Turn[]) {
  const counts = new Map<string, number>();

  for (const turn of turns) counts.set(turn.project, (counts.get(turn.project) ?? 0) + 1);

  return [...counts].sort((a, b) => b[1] - a[1]);
}

export function tokensOf(turns: Turn[]) {
  return turns.reduce(
    (sum, turn) => ({ input: sum.input + turn.tokens.input, output: sum.output + turn.tokens.output, cached: sum.cached + turn.tokens.cached }),
    { input: 0, output: 0, cached: 0 },
  );
}
