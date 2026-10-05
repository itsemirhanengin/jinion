import { Circle, CircleCheck } from 'lucide-react';
import { useState } from 'react';
import { classNames } from '../lib/class-names.js';
import { Spinner } from '../primitives/spinner.js';
import { WorkLine } from './work-line.js';

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
  pending: <Circle className="size-4 shrink-0 text-faint" />,
  active: (
    <span className="flex size-4 shrink-0 justify-center">
      <Spinner />
    </span>
  ),
  done: <CircleCheck className="size-4 shrink-0 text-added" />,
};

/** The agent's todos in one line, `Completed 5 of 5 todos`, that opens into the list. */
export function Todos({ groups }: { groups: TodoGroup[] }) {
  const [open, setOpen] = useState(false);

  const items = groups.flatMap((group) => group.items);
  const done = items.filter((item) => item.status === 'done').length;
  const finished = done === items.length;

  return (
    <div className="flex flex-col gap-1">
      <WorkLine open={open} onToggle={() => setOpen(!open)}>
        <span>
          {finished ? 'Completed' : 'Done'} {done} of {items.length} todos
        </span>
      </WorkLine>
      {open && (
        <div className="ml-1.5 animate-enter border-l border-line py-1 pl-4">
          <TodoList groups={groups} />
        </div>
      )}
    </div>
  );
}

export function TodoList({ groups }: { groups: TodoGroup[] }) {
  return (
    <div className="flex flex-col gap-2">
      {groups.map((group, index) => (
        <div key={index} className="flex flex-col gap-1">
          {groups.length > 1 && <span className="text-muted">{group.title}</span>}
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
