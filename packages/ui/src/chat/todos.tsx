import { Circle, CircleCheck, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { classNames } from '../lib/class-names.js';

export type TodoStatus = 'pending' | 'active' | 'done';

export interface TodoItem {
  text: string;
  status: TodoStatus;
}

export interface TodoGroup {
  title: string;
  items: TodoItem[];
}

const icons = {
  pending: <Circle className="size-3.5 shrink-0 text-faint" />,
  active: <LoaderCircle className="size-3.5 shrink-0 animate-spin text-working" />,
  done: <CircleCheck className="size-3.5 shrink-0 text-accent" />,
};

/** The agent's todos in one line, `Completed 5 of 5 todos`, that opens into the list. */
export function Todos({ groups }: { groups: TodoGroup[] }) {
  const [open, setOpen] = useState(false);

  const items = groups.flatMap((group) => group.items);
  const done = items.filter((item) => item.status === 'done').length;
  const finished = done === items.length;

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={() => setOpen(!open)} className="inline-flex w-fit cursor-default items-center gap-1.5 text-muted">
        {finished ? 'Completed' : 'Done'} {done} of {items.length} todos
        {finished ? icons.done : icons.active}
      </button>
      {open && <TodoList groups={groups} />}
    </div>
  );
}

export function TodoList({ groups }: { groups: TodoGroup[] }) {
  return (
    <div className="flex flex-col gap-2">
      {groups.map((group, index) => (
        <div key={index} className="flex flex-col gap-1">
          {groups.length > 1 && <span className="text-small text-faint">{group.title}</span>}
          {group.items.map((item, itemIndex) => (
            <div key={itemIndex} className="flex items-center gap-2">
              {icons[item.status]}
              <span className={classNames(item.status === 'done' && 'text-muted line-through decoration-faint', item.status === 'active' && 'font-medium')}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
