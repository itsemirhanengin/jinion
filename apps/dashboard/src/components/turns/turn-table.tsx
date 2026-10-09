import Link from 'next/link';
import { StatusBadge } from '@/components/ui/status-badge';
import type { Turn } from '@/lib/data';
import { formatCompact, formatDuration, formatStamp } from '@/lib/format';
import { OUTCOMES, SIGNALS } from '@/lib/labels';
import { isProblem } from '@/lib/problems';

/** A short list of turns, newest first, each a link to its page; for detail pages and the overview. */
export function TurnTable({ turns, people, emptyText }: { turns: Turn[]; people?: Map<string, string>; emptyText: string }) {
  if (turns.length === 0) return <p className="py-12 text-center text-neutral-500">{emptyText}</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-left whitespace-nowrap">
        <thead>
          <tr className="text-neutral-600 *:bg-neutral-100 *:py-1.5 *:first:rounded-l-lg *:last:rounded-r-lg">
            <th className="px-2 pl-3 font-normal">Started</th>
            {people && <th className="px-2 font-normal">Person</th>}
            <th className="px-2 font-normal">Project</th>
            <th className="px-2 font-normal">Outcome</th>
            <th className="px-2 font-normal">Signals</th>
            <th className="px-2 text-right font-normal">Took</th>
            <th className="px-2 pr-3 text-right font-normal">Tokens</th>
          </tr>
        </thead>
        <tbody>
          {turns.map((turn) => (
            <tr key={turn.id} className="*:border-b *:border-neutral-950/8 *:py-1.5">
              <td className="px-2 pl-3 tabular-nums">
                <Link transitionTypes={['nav-forward']} href={`/turns/${turn.id}`} className="hover:underline">
                  {formatStamp(turn.startedAt)}
                </Link>
              </td>
              {people && <td className="px-2">{people.get(turn.user)}</td>}
              <td className="px-2">{turn.project}</td>
              <td className="px-2">
                <StatusBadge tone={OUTCOMES[turn.outcome].tone}>{OUTCOMES[turn.outcome].label}</StatusBadge>
              </td>
              <td className="px-2">
                <SignalBadges signals={turn.signals} />
              </td>
              <td className="px-2 text-right tabular-nums">{formatDuration(turn.durationMs)}</td>
              <td className="px-2 pr-3 text-right tabular-nums">{formatCompact(turn.tokens.input + turn.tokens.output)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The outcome next to the signals already says these.
const SAID_BY_OUTCOME: Turn['signals'] = ['failed', 'interrupted'];

/** A turn's signals beyond its outcome, the problems first; the ordinary ones in grey. */
export function SignalBadges({ signals, dashWhenNone = true }: { signals: Turn['signals']; dashWhenNone?: boolean }) {
  const shown = signals.filter((signal) => !SAID_BY_OUTCOME.includes(signal));
  if (shown.length === 0) return dashWhenNone ? <span className="text-neutral-400">—</span> : null;

  const sorted = shown.sort((a, b) => Number(isProblem(b)) - Number(isProblem(a)));

  return (
    <span className="inline-flex flex-wrap gap-1">
      {sorted.map((signal) => (
        <StatusBadge key={signal} tone={isProblem(signal) ? SIGNALS[signal].tone : 'neutral'}>
          {SIGNALS[signal].label}
        </StatusBadge>
      ))}
    </span>
  );
}
