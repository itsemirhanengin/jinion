import type { MetricId } from '@/lib/data/types';

// What each metric means; no data here, so the browser can use it too.

export type Unit = 'users' | 'percent' | 'days' | 'turns';

export interface Metric {
  id: MetricId;
  label: string;
  description: string;
  unit: Unit;
  /** Whether a lower value is the better one. */
  lowerIsBetter?: boolean;
  /** Days into the beta before it means anything, e.g. a week for who is still around a week later. */
  measurableAfterDays?: number;
}

export const METRICS: Metric[] = [
  { id: 'active-users', label: 'Active users', description: 'People who ran at least one turn in the last 7 days.', unit: 'users' },
  {
    id: 'retained',
    label: 'Still using it',
    description: 'Of the people who joined a week or more ago, the share who ran a turn in the last 7 days.',
    unit: 'percent',
    measurableAfterDays: 7,
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

export type GoalStatus = 'on-track' | 'at-risk' | 'met' | 'missed';

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
