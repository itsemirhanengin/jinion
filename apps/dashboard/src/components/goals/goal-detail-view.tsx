'use client';

import { Target } from 'lucide-react';
import { DailyBars } from '@/components/charts/daily-bars';
import { GoalChart } from '@/components/charts/goal-chart';
import { PersonBars } from '@/components/charts/person-bars';
import { type DetailNav, DetailHeader } from '@/components/detail/detail-header';
import { DetailBody, DetailTitle, Facts, Section, SideSection } from '@/components/detail/parts';
import { GoalSentence } from '@/components/goals/goal-card';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Goal } from '@/lib/data';
import { formatDate } from '@/lib/format';
import type { GoalTrack } from '@/lib/goal-track';
import { GOAL_STATUSES } from '@/lib/labels';
import { formatMetric, type Metric, metricOf } from '@/lib/metric-defs';

export function GoalDetailView({
  goal,
  track,
  people,
  days,
  nav,
}: {
  goal: Goal;
  track: GoalTrack;
  people: { metric: Metric; people: { name: string; value: number }[]; idle: string[] };
  days: { day: string; clean: number; problem: number; people: number }[];
  nav: DetailNav;
}) {
  const metric = metricOf(goal.metric);
  const format = (value: number) => formatMetric(value, metric.unit);
  const personal = people.metric.id === metric.id;

  return (
    <>
      <DetailHeader section="Goals" icon={Target} nav={nav} itemNoun="goal" />

      <DetailBody
        aside={
          <>
            <SideSection title="The metric">
              <p className="text-neutral-600">{metric.description}</p>
              <Facts
                rows={[
                  { label: 'Measures', value: metric.label },
                  { label: metric.lowerIsBetter ? 'Target, at most' : 'Target, at least', value: format(goal.target) },
                  { label: 'Started', value: formatDate(goal.startsAt) },
                  { label: 'Deadline', value: formatDate(goal.deadline) },
                  { label: 'Days left', value: track.daysLeft },
                ]}
              />
            </SideSection>
            <SideSection title="Your decision">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-neutral-500">If it's met</p>
                  <p>{goal.ifMet}</p>
                </div>
                <div>
                  <p className="text-neutral-500">If it's missed</p>
                  <p>{goal.ifMissed}</p>
                </div>
              </div>
            </SideSection>
          </>
        }
      >
        <DetailTitle
          title={goal.name}
          badges={<StatusBadge tone={GOAL_STATUSES[track.status].tone}>{GOAL_STATUSES[track.status].label}</StatusBadge>}
          subtitle={`${metric.label} · until ${formatDate(goal.deadline)}`}
        />

        <section className="flex flex-col gap-3">
          <GoalSentence goal={goal} metric={metric} track={track} format={format} />
          <GoalChart track={track} target={goal.target} format={format} percent={metric.unit === 'percent'} />
        </section>

        <Section title="By person">
          <p className="-mt-1 text-neutral-500">
            {personal
              ? `Each person's own ${metric.label.toLocaleLowerCase('en')} over the last 7 days; amber where they are on the wrong side of the target.`
              : `Each person's active days over the last 7, which is what each one adds to ${metric.label.toLocaleLowerCase('en')}.`}
          </p>
          <PersonBars
            people={people.people}
            label={people.metric.label}
            format={(n) => formatMetric(n, people.metric.unit)}
            target={personal ? goal.target : undefined}
            lowerIsBetter={metric.lowerIsBetter}
            percent={people.metric.unit === 'percent'}
          />
          {people.idle.length > 0 && <p className="text-neutral-500">No turns in the last 7 days: {people.idle.join(', ')}.</p>}
        </Section>

        <Section title="Day by day">
          <p className="-mt-1 text-neutral-500">Every turn run each day, and how many of them had a problem.</p>
          <DailyBars days={days} />
        </Section>
      </DetailBody>
    </>
  );
}
