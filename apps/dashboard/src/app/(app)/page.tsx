import { House } from 'lucide-react';
import { StatStrip } from '@/components/detail/stat-strip';
import { OverviewCharts } from '@/components/overview-charts';
import { PageBody, PageHeader } from '@/components/page';
import { PageTransition } from '@/components/page-transition';
import { NOW } from '@/lib/clock';
import { listTurns } from '@/lib/data';
import { formatCount, formatPercent, formatStamp } from '@/lib/format';
import { activeUsers } from '@/lib/metrics';

export default async function OverviewPage() {
  const days = activeUsers(await listTurns());
  const today = days.at(-1) ?? { dau: 0, wau: 0, mau: 0, turns: 0 };
  const weekAgo = days.at(-8);
  const trend = (key: 'dau' | 'wau' | 'mau' | 'turns') => ({ current: days.slice(-7).map((day) => day[key]), previous: days.slice(-14, -7).map((day) => day[key]) });
  const change = (key: 'dau' | 'wau' | 'mau' | 'turns') => (weekAgo?.[key] ? ((today[key] - weekAgo[key]) / weekAgo[key]) * 100 : null);

  return (
    <PageTransition>
      <PageHeader>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h1 className="flex items-center gap-1.5 self-center text-base/6 font-medium sm:text-sm/6">
            <House className="size-4 shrink-0 stroke-neutral-600" />
            Overview
          </h1>
          <p className="truncate text-sm/6 text-neutral-500 tabular-nums sm:text-xs/6">To {formatStamp(NOW)}</p>
        </div>
      </PageHeader>

      <PageBody className="pb-24">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 pt-6">
          <StatStrip
            stats={[
              { label: 'DAU', value: today.dau, hint: 'People who ran a turn today.', change: change('dau'), trend: trend('dau') },
              { label: 'WAU', value: today.wau, hint: 'People who ran a turn in the last 7 days.', change: change('wau'), trend: trend('wau') },
              { label: 'MAU', value: today.mau, hint: 'People who ran a turn in the last 30 days.', change: change('mau'), trend: trend('mau') },
              {
                label: 'Stickiness',
                value: formatPercent(today.mau ? today.dau / today.mau : 0),
                hint: 'DAU over MAU: on an average day, the share of this month’s people who come back.',
              },
              { label: 'Turns today', value: formatCount(today.turns), change: change('turns'), trend: trend('turns') },
            ]}
          />
          <OverviewCharts days={days} />
        </div>
      </PageBody>
    </PageTransition>
  );
}
