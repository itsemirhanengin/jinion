import { ChevronRight, Circle, CircleCheck, ListChecks } from 'lucide-react';
import { useState } from 'react';
import { classNames } from '../lib/class-names.js';
import { Spinner } from '../primitives/spinner.js';
import { WorkBody, WorkLine } from './work-line.js';

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
  pending: <Circle className="size-3.5 text-faint" />,
  active: <Spinner />,
  done: <CircleCheck className="size-3.5 text-added" />,
};

/** The agent's todos in one line, `Completed 5 of 5 todos`, that opens into the list. */
export function Todos({ groups }: { groups: TodoGroup[] }) {
  const [open, setOpen] = useState(false);

  const items = groups.flatMap((group) => group.items);
  const done = items.filter((item) => item.status === 'done').length;
  const finished = done === items.length;

  return (
    <div className="flex flex-col">
      <WorkLine icon={<ListChecks />} open={open} onToggle={() => setOpen(!open)}>
        <span>
          {finished ? 'Completed' : 'Done'} {done} of {items.length} todos
        </span>
      </WorkLine>
      {open && (
        <WorkBody>
          <TodoList groups={groups} />
        </WorkBody>
      )}
    </div>
  );
}

/**
 * The running turn's todos as the first line inside the composer, `3 of 6  Put it in front of /api`, drawn as the
 * conversation's own lines are; it opens into the list in the same box.
 */
export function TodoBar({ groups }: { groups: TodoGroup[] }) {
  const [open, setOpen] = useState(false);

  const items = groups.flatMap((group) => group.items);
  const done = items.filter((item) => item.status === 'done').length;
  const current = items.find((item) => item.status === 'active') ?? items.find((item) => item.status === 'pending');

  return (
    <div className="border-b border-line">
      <button type="button" onClick={() => setOpen(!open)} className="group flex h-9 w-full cursor-default items-center gap-2 px-4 text-left text-muted hover:text-ink">
        <span className="flex size-4 shrink-0 items-center justify-center text-faint [&_svg]:size-3.5">
          <ListChecks />
        </span>
        <span className="shrink-0 tabular-nums">
          {done} of {items.length}
        </span>
        {current && <span className="min-w-0 truncate text-ink/75">{current.text}</span>}
        <ChevronRight className={classNames('size-3.5 shrink-0 text-faint opacity-0 transition group-hover:opacity-100', open && '-rotate-90 opacity-100')} />
      </button>
      {open && (
        <div className="animate-enter px-4 pb-2 pl-10">
          <TodoList groups={groups} />
        </div>
      )}
    </div>
  );
}

/** Each todo as a line of the conversation's height, its group's name above it when there are several. */
export function TodoList({ groups }: { groups: TodoGroup[] }) {
  return (
    <div className="flex flex-col">
      {groups.map((group, index) => (
        <div key={index} className="flex flex-col">
          {groups.length > 1 && <span className="flex h-7 items-end pb-1 text-small text-faint">{group.title}</span>}
          {group.items.map((item, itemIndex) => (
            <div key={itemIndex} className="flex h-7 items-center gap-2">
              <span className="flex size-4 shrink-0 items-center justify-center">{icons[item.status]}</span>
              <span className={classNames('min-w-0 truncate', item.status === 'done' && 'text-muted line-through decoration-faint', item.status === 'pending' && 'text-muted')}>
                {item.text}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
