import Link from 'next/link';
import { formatCount, formatShortDate } from '@/lib/format';
import type { Overview } from '@/lib/overview';

// From a light tint for a few turns to full sky for the busiest days of anyone.
const SHADES = ['bg-sky-100', 'bg-sky-200', 'bg-sky-300', 'bg-sky-400', 'bg-sky-500', 'bg-sky-600'];

/** A row of days for each person, darker the more turns they ran; a dot marks days where a third or more had a problem. */
export function ActivityGrid({ activity }: { activity: Overview['activity'] }) {
  const busiest = Math.max(1, ...activity.people.flatMap((person) => person.cells.map((cell) => cell.turns)));
  const shade = (turns: number) => SHADES[Math.min(SHADES.length - 1, Math.floor((Math.sqrt(turns) / Math.sqrt(busiest)) * SHADES.length))];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="w-32" />
            {activity.days.map((day, index) => (
              <th key={day} className="text-center text-xs/5 font-normal whitespace-nowrap text-neutral-500">
                {index % 2 === 0 ? formatShortDate(`${day}T12:00:00.000Z`).split(' ')[0] : ''}
              </th>
            ))}
            <th className="w-16 pl-2 text-right text-xs/5 font-normal text-neutral-500">Turns</th>
          </tr>
        </thead>
        <tbody>
          {activity.people.map((person) => (
            <tr key={person.id}>
              <th className="pr-2 text-left font-normal whitespace-nowrap">
                <Link href={`/users/${person.id}`} className="hover:underline">
                  {person.name}
                </Link>
              </th>
              {person.cells.map((cell, index) => {
                const day = activity.days[index]!;
                const before = day < person.joined;
                const troubled = cell.turns > 0 && cell.problems / cell.turns >= 1 / 3;

                return (
                  <td key={day} className="p-0">
                    <div
                      title={
                        before
                          ? `${formatShortDate(`${day}T12:00:00.000Z`)}: not joined yet`
                          : `${formatShortDate(`${day}T12:00:00.000Z`)}: ${cell.turns} turns, ${cell.problems} with a problem`
                      }
                      className={`relative mx-auto grid size-6 place-items-center rounded-md ${before ? 'bg-transparent ring-1 ring-neutral-950/5 ring-inset' : cell.turns ? shade(cell.turns) : 'bg-neutral-950/5'}`}
                    >
                      {troubled && <span className="size-1.5 rounded-full bg-amber-500 ring-2 ring-white" aria-hidden="true" />}
                    </div>
                  </td>
                );
              })}
              <td className="pl-2 text-right tabular-nums">{formatCount(person.cells.reduce((sum, cell) => sum + cell.turns, 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs/5 text-neutral-600">
        <span className="flex items-center gap-1.5">
          Fewer
          {SHADES.map((color) => (
            <span key={color} className={`size-3 rounded-sm ${color}`} aria-hidden="true" />
          ))}
          More turns
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-amber-500" aria-hidden="true" />A third or more had a problem
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-neutral-950/5" aria-hidden="true" />
          No turns
        </span>
      </div>
    </div>
  );
}
