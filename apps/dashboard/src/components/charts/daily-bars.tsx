'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatShortDate } from '@/lib/format';

const config: ChartConfig = {
  clean: { label: 'Went well', color: 'var(--color-sky-500)' },
  problem: { label: 'Had a problem', color: 'var(--color-amber-400)' },
};

/** Each day's turns as a bar: those that went well below, those with a problem on top. */
export function DailyBars({ days }: { days: { day: string; clean: number; problem: number; people: number }[] }) {
  return (
    <div>
      <ChartContainer config={config} className="aspect-auto h-52 w-full">
        <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={formatShortDate} />
          <YAxis tickLine={false} axisLine={false} width={48} />
          <ChartTooltip
            cursor={{ fill: 'var(--color-neutral-950)', fillOpacity: 0.04 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const day = payload?.[0]?.payload;

                  return day ? `${formatShortDate(day.day)} · ${day.people} ${day.people === 1 ? 'person' : 'people'}` : '';
                }}
              />
            }
          />
          <Bar dataKey="clean" stackId="turns" fill="var(--color-clean)" animationDuration={600} />
          <Bar dataKey="problem" stackId="turns" fill="var(--color-problem)" radius={[4, 4, 0, 0]} animationDuration={600} />
        </BarChart>
      </ChartContainer>
      <ul role="list" className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs/5 text-neutral-600">
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-500" aria-hidden="true" />
          Went well
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-400" aria-hidden="true" />
          Had a problem
        </li>
      </ul>
    </div>
  );
}
