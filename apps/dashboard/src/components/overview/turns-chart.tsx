'use client';

import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatShortDate } from '@/lib/format';

const config: ChartConfig = {
  clean: { label: 'Went well', color: 'var(--color-sky-500)' },
  problem: { label: 'Had a problem', color: 'var(--color-amber-400)' },
  rate: { label: 'Problem rate', color: 'var(--color-neutral-950)' },
};

/** Each day's turns as stacked bars, and the share with a problem as a line on its own scale. */
export function TurnsChart({ days }: { days: { day: string; clean: number; problem: number }[] }) {
  const data = days.map((day) => ({ ...day, rate: day.clean + day.problem ? (day.problem / (day.clean + day.problem)) * 100 : 0 }));

  return (
    <div>
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <ComposedChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={formatShortDate} />
          <YAxis yAxisId="turns" tickLine={false} axisLine={false} width={40} />
          <YAxis yAxisId="rate" orientation="right" tickLine={false} axisLine={false} width={40} domain={[0, 50]} tickFormatter={(value: number) => `${value}%`} />
          <ChartTooltip
            cursor={{ fill: 'var(--color-neutral-950)', fillOpacity: 0.04 }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => formatShortDate(String(payload?.[0]?.payload?.day ?? ''))}
                formatter={(value, name) => (
                  <span className="flex w-full justify-between gap-3">
                    <span className="text-neutral-500">{config[String(name)]?.label}</span>
                    <span className="font-medium tabular-nums">{name === 'rate' ? `${Number(value).toFixed(1)}%` : String(value)}</span>
                  </span>
                )}
              />
            }
          />
          <Bar yAxisId="turns" dataKey="clean" stackId="turns" fill="var(--color-clean)" animationDuration={600} />
          <Bar yAxisId="turns" dataKey="problem" stackId="turns" fill="var(--color-problem)" radius={[4, 4, 0, 0]} animationDuration={600} />
          <Line yAxisId="rate" dataKey="rate" type="monotone" stroke="var(--color-rate)" strokeWidth={1.5} dot={{ r: 2.5, fill: 'var(--color-rate)' }} animationDuration={600} />
        </ComposedChart>
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
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-neutral-950" aria-hidden="true" />
          Problem rate, right
        </li>
      </ul>
    </div>
  );
}
