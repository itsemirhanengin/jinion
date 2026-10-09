'use client';

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { niceMax } from './scale';

const config: ChartConfig = { value: { label: 'Value', color: 'var(--color-sky-500)' } };

/** One bar per person; those on the wrong side of the target in amber, so it is clear who holds a goal back. */
export function PersonBars({
  people,
  label,
  format,
  target,
  lowerIsBetter,
  percent = false,
}: {
  people: { name: string; value: number }[];
  label: string;
  format: (value: number) => string;
  target?: number;
  lowerIsBetter?: boolean;
  /** Keeps the axis at 100% at most. */
  percent?: boolean;
}) {
  const sorted = [...people].sort((a, b) => (lowerIsBetter ? a.value - b.value : b.value - a.value));
  const meets = (value: number) => target === undefined || (lowerIsBetter ? value <= target : value >= target);

  return (
    <ChartContainer config={config} className="aspect-auto w-full" style={{ height: sorted.length * 40 + 24 }}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: number) => format(value)}
          domain={[0, (max: number) => niceMax(Math.max(max, target ?? 0) * 1.05, percent)]}
        />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={110} />
        <ChartTooltip
          cursor={{ fill: 'var(--color-neutral-950)', fillOpacity: 0.04 }}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(value) => (
                <span className="flex w-full justify-between gap-3">
                  <span className="text-neutral-500">{label}</span>
                  <span className="font-medium tabular-nums">{format(Number(value))}</span>
                </span>
              )}
            />
          }
        />
        {target !== undefined && <ReferenceLine x={target} stroke="var(--color-neutral-400)" strokeDasharray="3 3" />}
        <Bar dataKey="value" radius={4} barSize={18} animationDuration={600}>
          {sorted.map((person) => (
            <Cell key={person.name} fill={meets(person.value) ? 'var(--color-sky-500)' : 'var(--color-amber-400)'} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
