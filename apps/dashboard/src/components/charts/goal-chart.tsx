'use client';

import { useId } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, XAxis, YAxis } from 'recharts';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatShortDate } from '@/lib/format';
import type { GoalTrack } from '@/lib/goal-track';
import { niceMax } from './scale';

/**
 * A goal from its start to its deadline: what happened as a solid line, the way to the target as a dotted one, and from
 * today where the last week's pace leads, dashed, in green when it reaches the target and in amber when it falls short.
 */
export function GoalChart({
  track,
  target,
  format,
  percent,
  compact = false,
}: {
  track: GoalTrack;
  target: number;
  format: (value: number) => string;
  percent: boolean;
  /** For a card: shorter, with only the start, today and the deadline under it. */
  compact?: boolean;
}) {
  const fill = useId();
  const reaches = track.status === 'on-track' || track.status === 'met';
  const ahead = reaches ? 'var(--color-green-500)' : 'var(--color-amber-500)';
  const first = track.points[0]?.day;
  const last = track.points.at(-1)?.day;
  const top = niceMax(Math.max(target, ...track.points.map((point) => Math.max(point.actual ?? 0, point.projection ?? 0, point.path))) * 1.05, percent);

  const config: ChartConfig = {
    actual: { label: 'So far', color: 'var(--color-sky-500)' },
    path: { label: 'On the way to the target', color: 'var(--color-neutral-400)' },
    projection: { label: 'At this pace', color: ahead },
  };

  return (
    <div>
      <ChartContainer config={config} className={`aspect-auto w-full ${compact ? 'h-44' : 'h-72'}`}>
        <ComposedChart data={track.points} margin={{ top: 24, right: compact ? 8 : 16, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={fill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-actual)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--color-actual)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={compact ? 8 : 32}
            ticks={compact ? [first, track.today, last].filter((day): day is string => day !== undefined) : undefined}
            tickFormatter={(day: string) => (day === track.today ? 'Today' : formatShortDate(day))}
          />
          <YAxis tickLine={false} axisLine={false} width={compact ? 40 : 48} tickCount={compact ? 3 : 5} domain={[0, top]} tickFormatter={(value: number) => format(value)} />
          <ChartTooltip
            cursor={{ stroke: 'var(--color-neutral-300)' }}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => formatShortDate(String(payload?.[0]?.payload?.day ?? ''))}
                formatter={(value, name) => (
                  <span className="flex w-full justify-between gap-3">
                    <span className="text-neutral-500">{config[String(name)]?.label}</span>
                    <span className="font-medium tabular-nums">{format(Number(value))}</span>
                  </span>
                )}
              />
            }
          />
          <ReferenceLine y={target} stroke="var(--color-neutral-300)" strokeDasharray="2 4" />
          <ReferenceLine x={track.today} stroke="var(--color-neutral-300)" />
          <Line dataKey="path" type="linear" stroke="var(--color-path)" strokeWidth={1.5} strokeDasharray="1 4" strokeLinecap="round" dot={false} isAnimationActive={false} />
          <Area dataKey="actual" type="monotone" stroke="var(--color-actual)" strokeWidth={2} fill={`url(#${fill})`} dot={false} connectNulls={false} animationDuration={600} />
          <Line dataKey="projection" type="linear" stroke="var(--color-projection)" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls={false} isAnimationActive={false} />
          {last && <ReferenceDot x={last} y={target} r={4} fill="white" stroke="var(--color-neutral-950)" strokeWidth={1.5} label={compact ? undefined : { value: `Target ${format(target)}`, position: 'insideBottomRight', offset: 12, fontSize: 12, fill: 'var(--color-neutral-700)' }} />}
          {last && track.status !== 'met' && track.status !== 'missed' && (
            <ReferenceDot
              x={last}
              y={track.projected}
              r={3.5}
              fill={ahead}
              stroke="white"
              strokeWidth={1.5}
              label={compact ? undefined : { value: `${format(track.projected)} at this pace`, position: 'insideTopRight', offset: 12, fontSize: 12, fill: ahead }}
            />
          )}
        </ComposedChart>
      </ChartContainer>
      {!compact && (
        <ul role="list" className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs/5 text-neutral-600">
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-sky-500" aria-hidden="true" />
            So far
          </li>
          <li className="flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dotted border-neutral-400" aria-hidden="true" />
            On the way to the target
          </li>
          <li className="flex items-center gap-1.5">
            <span className={`w-4 border-t-2 border-dashed ${reaches ? 'border-green-500' : 'border-amber-500'}`} aria-hidden="true" />
            At this pace
          </li>
        </ul>
      )}
    </div>
  );
}
