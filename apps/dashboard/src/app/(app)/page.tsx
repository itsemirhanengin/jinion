import { House } from 'lucide-react';
import { StatStrip } from '@/components/detail/stat-strip';
import { ActivityGrid } from '@/components/overview/activity-grid';
import { CompareBars } from '@/components/overview/compare-bars';
import { GoalBars } from '@/components/overview/goal-bars';
import { NeedsALook } from '@/components/overview/needs-a-look';
import { Panel } from '@/components/overview/panel';
import { SignalsChart } from '@/components/overview/signals-chart';
import { TokensChart } from '@/components/overview/tokens-chart';
import { TurnsChart } from '@/components/overview/turns-chart';
import { PageBody, PageHeader } from '@/components/page';
import { PageTransition } from '@/components/page-transition';
import { admin } from '@/lib/admin';
import { NOW } from '@/lib/clock';
import { formatCount, formatStamp } from '@/lib/format';
import { overview } from '@/lib/overview';

export default async function OverviewPage() {
  const data = await overview();
  const { summary, compare } = data;
  const overall = (100 - summary.wentWell) / 100;

  return (
    <PageTransition>
      <PageHeader>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h1 className="flex items-center gap-1.5 self-center text-base/6 font-medium sm:text-sm/6">
            <House className="size-4 shrink-0 stroke-neutral-600" />
            Overview
          </h1>
          <p className="truncate text-sm/6 text-neutral-500 tabular-nums sm:text-xs/6">The last 7 days, to {formatStamp(NOW)}</p>
        </div>
      </PageHeader>

      <PageBody className="pb-24">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 pt-8">
          <div>
            <p className="text-neutral-500">{greeting()}, {admin.name.split(' ')[0]}</p>
            <p className="text-2xl/8 font-semibold tracking-tight text-balance">
              {summary.active} of {summary.people} people used Jinion this week, and {Math.round(summary.wentWell)}% of their{' '}
              {formatCount(summary.turnsThisWeek)} turns went well.
              {summary.atRisk > 0 && (
                <span className="text-amber-700">
                  {' '}
                  {summary.atRisk} {summary.atRisk === 1 ? 'goal is' : 'goals are'} at risk.
                </span>
              )}
            </p>
          </div>

          <StatStrip stats={data.figures} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Panel title="Needs a look" description="What waits on you today.">
              <NeedsALook attention={data.attention} goals={data.goals} />
            </Panel>
            <Panel title="Goals" description="Where each metric is, and the mark it has to reach." more={{ href: '/goals', label: 'All goals' }}>
              <GoalBars goals={data.goals} />
            </Panel>
          </div>

          <Panel title="Who uses it" description="Each person's turns, day by day since the beta began." more={{ href: '/users', label: 'All users' }}>
            <ActivityGrid activity={data.activity} />
          </Panel>

          <Panel title="Turns and problems" description="Every turn each day, and the share of them that had a problem." more={{ href: '/turns', label: 'All turns' }}>
            <TurnsChart days={data.days} />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="What goes wrong" description="Each kind of problem, this week against the week before.">
              <SignalsChart signals={data.signals} />
            </Panel>
            <Panel title="Where it goes wrong" description="The share of turns with a problem this week; the line is everyone's.">
              <div className="flex flex-col gap-5">
                <CompareBars title="By agent" shares={compare.agent} overall={overall} />
                <CompareBars title="By client" shares={compare.client} overall={overall} />
                <CompareBars title="By kind of work" shares={compare.work} overall={overall} />
              </div>
            </Panel>
          </div>

          <Panel
            title="Tokens"
            description={`Input and output tokens each day, by agent.${data.limitsThisWeek ? ` Usage limits ran out ${data.limitsThisWeek} times this week.` : ''}`}
          >
            <TokensChart days={data.tokens} />
          </Panel>
        </div>
      </PageBody>
    </PageTransition>
  );
}

function greeting() {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Istanbul' }).format(new Date(NOW)));

  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';

  return 'Good evening';
}
