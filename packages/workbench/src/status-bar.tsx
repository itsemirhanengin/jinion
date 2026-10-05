import { classNames } from '@jinion/ui';
import { type ButtonHTMLAttributes, Fragment } from 'react';
import { useWorkbench } from './context.js';
import type { StatusItem } from './feature.js';

/** The project's state in one line, as the terminal's status line: `main · 3 changed     Opus 5.5 · ctx 40%`. */
export function StatusBar() {
  const workbench = useWorkbench();
  const left = workbench.statusAt('left');
  const right = workbench.statusAt('right');

  if (left.length === 0 && right.length === 0) return null;

  return (
    <footer className="flex h-7 shrink-0 items-stretch px-2 pb-1 font-mono text-[0.6875rem] text-muted">
      <Items items={left} />
      <div className="flex-1" />
      <Items items={right} />
    </footer>
  );
}

function Items({ items }: { items: StatusItem[] }) {
  return items.map(({ id, Item }, index) => (
    <Fragment key={id}>
      {index > 0 && <span className="flex items-center text-faint">·</span>}
      <Item />
    </Fragment>
  ));
}

export interface StatusButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Before the value, dimmed: `ctx` in `ctx 40%`. */
  label?: string;
}

/** A piece of the status bar; each opens what it is about. */
export function StatusButton({ label, className, children, type = 'button', ...props }: StatusButtonProps) {
  return (
    <button
      type={type}
      className={classNames(
        'flex cursor-default items-center gap-1.5 rounded-md px-1.5 whitespace-nowrap text-ink hover:bg-shade [&_svg]:size-3',
        className,
      )}
      {...props}
    >
      {label && <span className="text-muted">{label}</span>}
      {children}
    </button>
  );
}
