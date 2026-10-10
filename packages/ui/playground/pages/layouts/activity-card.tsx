import { classNames, SharedTooltip, TooltipTrigger, tooltipHandle } from '@jinion/ui';
import { useMemo } from 'react';
import { Card } from './workbench.js';

const WEEKS = 53;

/** From nothing to the busiest days, in the primary color growing stronger, as the profile's activity draws it. */
const LEVELS = ['bg-shade', 'bg-primary/20', 'bg-primary/40', 'bg-primary/65', 'bg-primary'];

const projects = ['coding-agent', 'sit-dashboard', 'bugece-web'];

const dayLabel = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

interface Note {
  when: string;
  what: string;
}

/** The user's year with Jinion, a square a day in their color, said in one line; a day tells what was done on it. */
export function ActivityCard() {
  const tip = useMemo(() => tooltipHandle<Note>(), []);
  const days = useMemo(() => year(new Date()), []);

  return (
    <Card title="Your activity" detail="12-day streak" action="Profile">
      <SharedTooltip
        handle={tip}
        render={(note: Note) => (
          <span className="flex flex-col">
            <span className="text-muted">{note.when}</span>
            <span className="font-medium">{note.what}</span>
          </span>
        )}
      />
      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="grid grid-flow-col grid-rows-7 gap-[3px]" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
          {days.map((day) =>
            day.future ? (
              <span key={day.key} className="aspect-square" />
            ) : (
              <TooltipTrigger key={day.key} handle={tip} payload={day.note}>
                <span
                  className={classNames(
                    'aspect-square rounded-[2px] hover:ring-1 hover:ring-ink/40 hover:ring-offset-1 hover:ring-offset-background',
                    LEVELS[day.level],
                  )}
                />
              </TooltipTrigger>
            ),
          )}
        </div>
        <p className="text-pretty text-muted">312 threads · 1.9B tokens · mostly Opus 5.5 · busiest on Thursdays</p>
      </div>
    </Card>
  );
}

/** `WEEKS` columns of seven days, Monday first, ending this week: quiet until Jinion came in, then scattered the same way each time. */
function year(today: Date) {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) - (WEEKS - 1) * 7);

  return Array.from({ length: WEEKS * 7 }, (_, index) => {
    const date = new Date(monday);

    date.setDate(monday.getDate() + index);

    const noise = Math.abs(Math.sin(index * 12.9898) * 43758.5453) % 1;
    const level = index < 38 * 7 || noise < 0.2 ? 0 : Math.min(4, 1 + Math.floor((noise - 0.2) * 5));
    const threads = level * 3 + (index % 3);
    const project = projects[index % 5 === 0 ? 1 : index % 7 === 0 ? 2 : 0];

    return {
      key: index,
      future: date > today,
      level,
      note: { when: dayLabel.format(date), what: level === 0 ? 'Nothing that day' : `${threads} threads · mostly ${project}` },
    };
  });
}
