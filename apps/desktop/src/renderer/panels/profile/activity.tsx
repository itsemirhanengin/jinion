import { classNames, SharedTooltip, TooltipTrigger, tooltipHandle } from '@jinion/ui';
import { useMemo, useState } from 'react';
import { compact } from '../../lib/numbers.js';

type Mode = 'daily' | 'weekly' | 'cumulative';

const MODES: { mode: Mode; label: string }[] = [
  { mode: 'daily', label: 'Daily' },
  { mode: 'weekly', label: 'Weekly' },
  { mode: 'cumulative', label: 'Cumulative' },
];

const WEEKS = 53;

/** From no tokens to the busiest quarter of days, in one color growing stronger. */
const LEVELS = ['bg-shade', 'bg-primary/20', 'bg-primary/40', 'bg-primary/65', 'bg-primary'];

const dayLabel = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' });
const monthLabel = new Intl.DateTimeFormat('en', { month: 'short' });

/** What a square's tooltip says: the day or week, then its tokens. */
interface Note {
  when: string;
  what: string;
}

interface Cell {
  date: Date;
  value: number;
  /** After today, so nothing to show. */
  future: boolean;
}

/** A year of tokens, a column a week and a square a day, as a day's own, its week's or all of them up to it. */
export function Activity({ days }: { days: { date: string; tokens: number }[] }) {
  const [mode, setMode] = useState<Mode>('daily');

  const tip = useMemo(() => tooltipHandle<Note>(), []);
  const weeks = useMemo(() => grid(days, mode, new Date()), [days, mode]);
  const level = useMemo(() => levels(weeks.flat().filter((cell) => !cell.future && cell.value > 0).map((cell) => cell.value)), [weeks]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="flex-1 font-medium">Token activity</h2>
        {MODES.map((each) => (
          <button
            key={each.mode}
            type="button"
            onClick={() => setMode(each.mode)}
            className={classNames('cursor-default text-small', mode === each.mode ? 'text-ink' : 'text-faint hover:text-muted')}
          >
            {each.label}
          </button>
        ))}
      </div>
      <SharedTooltip
        handle={tip}
        render={(note: Note) => (
          <span className="flex flex-col">
            <span className="text-muted">{note.when}</span>
            <span className="font-medium tabular-nums">{note.what}</span>
          </span>
        )}
      />
      <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
        {weeks.map((week) =>
          week.map((cell) => {
            if (cell.future) return <span key={cell.date.getTime()} className="aspect-square" />;

            const note = {
              when: mode === 'weekly' ? `Week of ${dayLabel.format(week[0]!.date)}` : dayLabel.format(cell.date),
              what: `${compact(cell.value)} tokens${mode === 'cumulative' ? ' in total' : ''}`,
            };

            return (
              <TooltipTrigger key={cell.date.getTime()} handle={tip} payload={note}>
                <span
                  className={classNames(
                    'aspect-square rounded-[2px] hover:ring-1 hover:ring-ink/40 hover:ring-offset-1 hover:ring-offset-background',
                    LEVELS[level(cell.value)],
                  )}
                />
              </TooltipTrigger>
            );
          }),
        )}
      </div>
      <div className="grid text-small text-faint" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
        {weeks.map((week, index) => {
          const month = week[0]!.date.getMonth();
          const starts = index === 0 || weeks[index - 1]![0]!.date.getMonth() !== month;

          return (
            <span key={index} className="overflow-visible whitespace-nowrap">
              {starts && index < WEEKS - 2 ? monthLabel.format(week[0]!.date) : ''}
            </span>
          );
        })}
      </div>
    </section>
  );
}

/** `WEEKS` columns of seven days, Monday first, the last one holding today. */
function grid(days: { date: string; tokens: number }[], mode: Mode, today: Date): Cell[][] {
  const tokens = new Map(days.map((day) => [day.date, day.tokens]));
  const monday = startOfDay(today);

  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - (WEEKS - 1) * 7);

  // What was used before the first square counts toward the running total from the start.
  let running = days.filter((day) => day.date < keyOf(monday)).reduce((sum, day) => sum + day.tokens, 0);

  return Array.from({ length: WEEKS }, (_, week) => {
    const dates = Array.from({ length: 7 }, (_, day) => {
      const date = new Date(monday);

      date.setDate(monday.getDate() + week * 7 + day);

      return date;
    });

    const total = dates.reduce((sum, date) => sum + (tokens.get(keyOf(date)) ?? 0), 0);

    return dates.map((date) => {
      const own = tokens.get(keyOf(date)) ?? 0;

      running += own;

      return { date, future: date > today, value: mode === 'daily' ? own : mode === 'weekly' ? total : running };
    });
  });
}

/** Which of the levels a value takes: none for nothing, then by the quarter of the used days it falls in. */
function levels(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  const at = (share: number) => sorted[Math.floor((sorted.length - 1) * share)] ?? 0;
  const bounds = [at(0.25), at(0.5), at(0.75)];

  return (value: number) => (value <= 0 ? 0 : 1 + bounds.filter((bound) => value > bound).length);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function keyOf(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
