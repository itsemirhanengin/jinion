import { formatCount, formatPercent } from '@/lib/format';
import type { Share } from '@/lib/overview';

/**
 * Problem rates side by side for one way of splitting the turns, e.g. by agent; the bar is the rate, with the overall
 * rate marked across, so a group worse than the rest shows.
 */
export function CompareBars({ title, shares, overall }: { title: string; shares: Share[]; overall: number }) {
  const scale = Math.max(overall, ...shares.map((share) => share.problemRate)) * 1.2 || 1;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs/5 text-neutral-500">{title}</p>
      <ul role="list" className="flex flex-col gap-2">
        {[...shares]
          .sort((a, b) => b.problemRate - a.problemRate)
          .map((share) => (
            <li key={share.label} className="grid grid-cols-[6rem_minmax(0,1fr)_3.5rem] items-center gap-3">
              <span className="truncate">{share.label}</span>
              <span className="relative h-2 rounded-full bg-neutral-950/6">
                <span
                  className={`absolute inset-y-0 left-0 rounded-full ${share.problemRate > overall * 1.15 ? 'bg-amber-400' : 'bg-sky-500'}`}
                  style={{ width: `${(share.problemRate / scale) * 100}%` }}
                />
                <span aria-hidden="true" className="absolute -top-1 h-4 w-px bg-neutral-950/40" style={{ left: `${(overall / scale) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums" title={`${formatCount(share.turns)} turns`}>
                {formatPercent(share.problemRate)}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
