'use client';

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { card } from '@/components/data-table/buttons';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatShortDate } from '@/lib/format';

type Day = { day: string; dau: number; wau: number; mau: number; turns: number };

const active: ChartConfig = {
  dau: { label: 'Daily', color: 'var(--color-sky-500)' },
  wau: { label: 'Weekly', color: 'var(--color-violet-500)' },
  mau: { label: 'Monthly', color: 'var(--color-neutral-400)' },
};

const turns: ChartConfig = { turns: { label: 'Turns', color: 'var(--color-sky-500)' } };

/** Who used Jinion each day, week and month, and how many turns ran each day. */
export function OverviewCharts({ days }: { days: Day[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className={`${card} flex flex-col gap-4 p-4`}>
        <div>
          <h2 className="font-medium">Active users</h2>
          <p className="text-neutral-500">People who ran a turn that day, in the 7 days to it, and in the 30 days to it.</p>
        </div>
        <ChartContainer config={active} className="aspect-auto h-60 w-full">
          <LineChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={formatShortDate} />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={(_, payload) => formatShortDate(String(payload?.[0]?.payload?.day ?? ''))} />} />
            <Line dataKey="dau" type="monotone" stroke="var(--color-dau)" strokeWidth={2} dot={false} animationDuration={600} />
            <Line dataKey="wau" type="monotone" stroke="var(--color-wau)" strokeWidth={2} dot={false} animationDuration={600} />
            {/* On top, dashed, so it shows where it runs alongside the weekly line. */}
            <Line dataKey="mau" type="monotone" stroke="var(--color-mau)" strokeWidth={2} strokeDasharray="4 4" dot={false} animationDuration={600} />
          </LineChart>
        </ChartContainer>
        <Legend items={[['bg-sky-500', 'Daily'], ['bg-violet-500', 'Weekly'], ['bg-neutral-400', 'Monthly']]} />
      </section>

      <section className={`${card} flex flex-col gap-4 p-4`}>
        <div>
          <h2 className="font-medium">Turns</h2>
          <p className="text-neutral-500">Every turn everyone ran, day by day.</p>
        </div>
        <ChartContainer config={turns} className="aspect-auto h-60 w-full">
          <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={formatShortDate} />
            <YAxis tickLine={false} axisLine={false} width={40} allowDecimals={false} />
            <ChartTooltip
              cursor={{ fill: 'var(--color-neutral-950)', fillOpacity: 0.04 }}
              content={<ChartTooltipContent labelFormatter={(_, payload) => formatShortDate(String(payload?.[0]?.payload?.day ?? ''))} />}
            />
            <Bar dataKey="turns" fill="var(--color-turns)" radius={[4, 4, 0, 0]} animationDuration={600} />
          </BarChart>
        </ChartContainer>
        <Legend items={[['bg-sky-500', 'Turns']]} />
      </section>
    </div>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <ul role="list" className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs/5 text-neutral-600">
      {items.map(([color, label]) => (
        <li key={label} className="flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${color}`} aria-hidden="true" />
          {label}
        </li>
      ))}
    </ul>
  );
}
