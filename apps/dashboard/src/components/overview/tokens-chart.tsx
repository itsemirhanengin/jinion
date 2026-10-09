'use client';

import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatCompact, formatShortDate } from '@/lib/format';

const config: ChartConfig = {
  Claude: { label: 'Claude', color: 'var(--color-sky-500)' },
  Codex: { label: 'Codex', color: 'var(--color-violet-400)' },
};

/** Tokens read and written each day, stacked by agent. */
export function TokensChart({ days }: { days: { day: string; Claude: number; Codex: number }[] }) {
  const id = useId();

  return (
    <div>
      <ChartContainer config={config} className="aspect-auto h-56 w-full">
        <AreaChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {(['Claude', 'Codex'] as const).map((agent) => (
              <linearGradient key={agent} id={`${id}-${agent}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={`var(--color-${agent})`} stopOpacity={0.35} />
                <stop offset="100%" stopColor={`var(--color-${agent})`} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={formatShortDate} />
          <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={(value: number) => formatCompact(value)} />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => formatShortDate(String(payload?.[0]?.payload?.day ?? ''))}
                formatter={(value, name) => (
                  <span className="flex w-full justify-between gap-3">
                    <span className="text-neutral-500">{String(name)}</span>
                    <span className="font-medium tabular-nums">{formatCompact(Number(value))}</span>
                  </span>
                )}
              />
            }
          />
          <Area dataKey="Codex" stackId="tokens" type="monotone" stroke="var(--color-Codex)" strokeWidth={1.5} fill={`url(#${id}-Codex)`} animationDuration={600} />
          <Area dataKey="Claude" stackId="tokens" type="monotone" stroke="var(--color-Claude)" strokeWidth={1.5} fill={`url(#${id}-Claude)`} animationDuration={600} />
        </AreaChart>
      </ChartContainer>
      <ul role="list" className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs/5 text-neutral-600">
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-sky-500" aria-hidden="true" />
          Claude
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-violet-400" aria-hidden="true" />
          Codex
        </li>
      </ul>
    </div>
  );
}
