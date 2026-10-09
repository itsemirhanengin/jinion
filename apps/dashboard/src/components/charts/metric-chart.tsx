'use client';

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatShortDate } from '@/lib/format';

/** A metric day by day as a solid line, and its goal, when it has one, as a dashed line across. */
export function MetricChart({
  points,
  label,
  format,
  target,
}: {
  points: { day: string; value: number }[];
  label: string;
  format: (value: number) => string;
  target?: { value: number; label: string };
}) {
  const config: ChartConfig = { value: { label, color: 'var(--color-sky-500)' } };

  return (
    <div>
      <ChartContainer config={config} className="aspect-auto h-52 w-full">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={formatShortDate} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(value: number) => format(value)}
            domain={target ? [0, (max: number) => Math.max(max, target.value) * 1.1] : [0, 'auto']}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => formatShortDate(String(payload?.[0]?.payload?.day ?? ''))}
                formatter={(value) => (
                  <span className="flex w-full justify-between gap-3">
                    <span className="text-neutral-500">{label}</span>
                    <span className="font-medium tabular-nums">{format(Number(value))}</span>
                  </span>
                )}
              />
            }
          />
          {target && <ReferenceLine y={target.value} stroke="var(--color-neutral-400)" strokeDasharray="3 3" />}
          <Line dataKey="value" type="monotone" stroke="var(--color-value)" strokeWidth={2} dot={false} animationDuration={600} />
        </LineChart>
      </ChartContainer>
      <ul role="list" className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs/5 text-neutral-600">
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-500" aria-hidden="true" />
          {label}
        </li>
        {target && (
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-neutral-400" aria-hidden="true" />
            {target.label}
          </li>
        )}
      </ul>
    </div>
  );
}
