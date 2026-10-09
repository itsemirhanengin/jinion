'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { Signal } from '@/lib/data';
import { SIGNALS } from '@/lib/labels';

const config: ChartConfig = {
  thisWeek: { label: 'This week', color: 'var(--color-sky-500)' },
  weekBefore: { label: 'The week before', color: 'var(--color-sky-200)' },
};

/** Each kind of problem, this week against the week before, so what grows stands out. */
export function SignalsChart({ signals }: { signals: { signal: Signal; thisWeek: number; weekBefore: number }[] }) {
  const data = signals.map((row) => ({ ...row, label: SIGNALS[row.signal].label }));

  return (
    <div>
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: data.length * 44 + 24 }}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barGap={2}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={96} />
          <ChartTooltip cursor={{ fill: 'var(--color-neutral-950)', fillOpacity: 0.04 }} content={<ChartTooltipContent />} />
          <Bar dataKey="thisWeek" fill="var(--color-thisWeek)" radius={4} barSize={10} animationDuration={600} />
          <Bar dataKey="weekBefore" fill="var(--color-weekBefore)" radius={4} barSize={10} animationDuration={600} />
        </BarChart>
      </ChartContainer>
      <ul role="list" className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs/5 text-neutral-600">
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-500" aria-hidden="true" />
          This week
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-200" aria-hidden="true" />
          The week before
        </li>
      </ul>
    </div>
  );
}
