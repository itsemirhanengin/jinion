'use client';

import { useState } from 'react';
import { Plus, Target } from 'lucide-react';
import { primaryButton } from '@/components/data-table/buttons';
import { StatStrip } from '@/components/detail/stat-strip';
import { GoalCard } from '@/components/goals/goal-card';
import { NewGoalSheet } from '@/components/goals/new-goal-sheet';
import { PageBody, PageHeader } from '@/components/page';
import type { MetricId } from '@/lib/data';
import type { GoalCard as Card } from '@/lib/goal-cards';
import { trackGoal } from '@/lib/goal-track';
import type { GoalStatus } from '@/lib/metric-defs';

const ORDER: Record<GoalStatus, number> = { 'at-risk': 0, missed: 1, 'on-track': 2, met: 3 };

/** The goals as charts, the ones that need attention first, with a way to set a new one. */
export function GoalsView({ cards: initial, daily }: { cards: Card[]; daily: Record<MetricId, { day: string; value: number }[]> }) {
  // A goal made here stays on this page only, until the API keeps it.
  const [cards, setCards] = useState(initial);
  const [creating, setCreating] = useState(false);

  const saved = new Set(initial.map((card) => card.goal.id));
  const count = (status: GoalStatus) => cards.filter((card) => card.track.status === status).length;
  const sorted = [...cards].sort((a, b) => ORDER[a.track.status] - ORDER[b.track.status] || a.goal.deadline.localeCompare(b.goal.deadline));

  return (
    <>
      <PageHeader>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h1 className="flex items-center gap-1.5 self-center text-base/6 font-medium sm:text-sm/6">
            <Target className="size-4 shrink-0 stroke-neutral-600" />
            Goals
          </h1>
          <p className="truncate text-sm/6 text-neutral-500 tabular-nums sm:text-xs/6">
            {cards.length} {cards.length === 1 ? 'goal' : 'goals'} · {count('on-track') + count('met')} on their way
          </p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className={`flex items-center gap-1.5 py-1 pr-2.5 pl-1.5 text-sm/5 ${primaryButton}`}>
          <Plus className="size-4 shrink-0" />
          New goal
        </button>
      </PageHeader>

      <PageBody className="pb-24">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 pt-4">
          <StatStrip
            stats={[
              { label: 'At risk', value: count('at-risk'), hint: "At the last week's pace, it won't reach the target by the deadline." },
              { label: 'On track', value: count('on-track'), hint: "At the last week's pace, it reaches the target by the deadline." },
              { label: 'Met', value: count('met'), hint: 'Past the deadline, and the target held.' },
              { label: 'Missed', value: count('missed'), hint: 'Past the deadline, and the target did not hold.' },
            ]}
          />
          {sorted.length === 0 ? (
            <p className="py-12 text-center text-neutral-500">No goals yet. Set one before the beta starts, while you can still be honest about it.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {sorted.map((card) => (
                <GoalCard key={card.goal.id} {...card} saved={saved.has(card.goal.id)} />
              ))}
            </div>
          )}
        </div>
      </PageBody>

      <NewGoalSheet
        open={creating}
        onClose={() => setCreating(false)}
        now={Object.fromEntries(Object.entries(daily).map(([id, points]) => [id, points.at(-1)?.value ?? 0])) as Record<MetricId, number>}
        onCreate={(goal) => setCards((all) => [...all, { goal, track: trackGoal(goal, daily[goal.metric]) }])}
      />
    </>
  );
}
