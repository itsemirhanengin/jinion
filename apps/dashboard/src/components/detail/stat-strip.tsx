'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Hint } from '@/components/ui/hint';

export type Stat = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** Change against the previous period, in percent. */
  change?: number | null;
  /** Values over the period, oldest first, with the previous period's for comparison. */
  trend?: { current: number[]; previous: number[] };
};

/** A row of figures in one card; scrolls sideways with arrows on hover when it doesn't fit. `lead` sits fixed on the left. */
export function StatStrip({ stats, lead }: { stats: Stat[]; lead?: React.ReactNode }) {
  const scroller = useRef<HTMLDListElement>(null);

  const [edges, setEdges] = useState({ start: true, end: true });

  useEffect(() => {
    const element = scroller.current!;
    const update = () => setEdges({ start: element.scrollLeft <= 1, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 1 });
    const observer = new ResizeObserver(update);

    update();
    element.addEventListener('scroll', update, { passive: true });
    observer.observe(element);

    return () => {
      element.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);

  const scroll = (direction: 1 | -1) => scroller.current!.scrollBy({ left: direction * scroller.current!.clientWidth * 0.75, behavior: 'smooth' });

  const arrow =
    'grid size-7 place-items-center rounded-md text-neutral-700 hover:bg-neutral-950/5 hover:text-neutral-950 disabled:text-neutral-300 disabled:hover:bg-transparent';

  return (
    <div className="group relative flex rounded-xl bg-white ring-1 shadow-xs ring-neutral-950/8">
      {lead && <div className="shrink-0 border-r border-neutral-950/8 p-1">{lead}</div>}
      <dl ref={scroller} className="flex min-w-0 flex-1 snap-x scroll-px-1 overflow-x-auto p-1 [scrollbar-width:none]">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`relative shrink-0 snap-start rounded-lg px-3 py-2 not-first:before:absolute not-first:before:inset-y-2 not-first:before:left-0 not-first:before:w-px not-first:before:bg-neutral-950/8 hover:bg-neutral-950/4 hover:before:opacity-0 [&:hover+div]:before:opacity-0 ${stat.trend ? 'min-w-48' : 'min-w-40'} flex-1`}
          >
            <dt className="w-fit font-medium">
              <Hint text={stat.hint}>{stat.label}</Hint>
            </dt>
            <dd className="mt-0.5 flex items-end gap-2">
              <span className="tabular-nums">{stat.value}</span>
              {stat.change !== undefined && stat.change !== null && <Change value={stat.change} />}
              {stat.trend && (
                <span className="ml-auto">
                  <Sparkline {...stat.trend} />
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {!(edges.start && edges.end) && (
        <div className="pointer-events-none absolute inset-y-1 right-1 flex items-center gap-0.5 rounded-r-lg bg-linear-to-l from-white from-70% to-transparent pr-1 pl-8 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:hidden">
          <div className="pointer-events-auto flex rounded-lg bg-neutral-950/4">
            <button type="button" aria-label="Previous figures" disabled={edges.start} onClick={() => scroll(-1)} className={arrow}>
              <ChevronLeft className="size-4 shrink-0" />
            </button>
            <button type="button" aria-label="Next figures" disabled={edges.end} onClick={() => scroll(1)} className={arrow}>
              <ChevronRight className="size-4 shrink-0" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sparkline({ current, previous, stroke = 'stroke-sky-500' }: { current: number[]; previous: number[]; stroke?: string }) {
  const width = 64;
  const height = 20;
  const max = Math.max(1, ...current, ...previous);

  const points = (values: number[]) =>
    values
      .map((value, index) => `${((index / Math.max(1, values.length - 1)) * width).toFixed(1)},${(height - 1 - (value / max) * (height - 2)).toFixed(1)}`)
      .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-5 w-16 shrink-0 overflow-visible" aria-hidden="true">
      <polyline points={points(previous)} fill="none" strokeWidth="1" strokeDasharray="2 2" className="stroke-neutral-300" />
      <polyline points={points(current)} fill="none" strokeWidth="1.5" strokeLinejoin="round" className={stroke} />
    </svg>
  );
}

function Change({ value }: { value: number }) {
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <span className="inline-flex items-center gap-0.5 text-xs/5 text-neutral-500">
      <Icon className="size-3 shrink-0" />
      {Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}%
    </span>
  );
}
