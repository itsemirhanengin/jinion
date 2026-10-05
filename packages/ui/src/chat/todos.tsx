import { Circle, CircleCheck, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { classNames } from '../lib/class-names.js';

export type TodoStatus = 'pending' | 'in_progress' | 'completed';

export interface TodoItem {
  content: string;
  status: TodoStatus;
}

const icons = {
  pending: <Circle className="size-3.5 shrink-0 text-faint" />,
  in_progress: <LoaderCircle className="size-3.5 shrink-0 animate-spin text-working" />,
  completed: <CircleCheck className="size-3.5 shrink-0 text-accent" />,
};

/** The agent's todo list in one line, `Completed 5 of 5 todos`, that opens into the list. */
export function Todos({ items }: { items: TodoItem[] }) {
  const [open, setOpen] = useState(false);

  const done = items.filter((item) => item.status === 'completed').length;
  const finished = done === items.length;

  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" onClick={() => setOpen(!open)} className="inline-flex w-fit cursor-default items-center gap-1.5 text-muted">
        {finished ? 'Completed' : 'Done'} {done} of {items.length} todos
        {finished ? icons.completed : icons.in_progress}
      </button>
      {open && (
        <ul className="flex flex-col gap-1">
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-2">
              {icons[item.status]}
              <span className={classNames(item.status === 'completed' && 'text-muted line-through decoration-faint')}>{item.content}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
