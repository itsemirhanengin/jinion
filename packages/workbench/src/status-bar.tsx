import { classNames } from '@jinion/ui';
import type { ButtonHTMLAttributes } from 'react';
import { useWorkbench } from './context.js';

export function StatusBar() {
  const workbench = useWorkbench();

  return (
    <footer className="flex h-6 shrink-0 items-stretch border-t border-line bg-raised px-1 font-mono text-[11px] text-muted">
      {workbench.statusAt('left').map(({ id, Item }) => (
        <Item key={id} />
      ))}
      <div className="flex-1" />
      {workbench.statusAt('right').map(({ id, Item }) => (
        <Item key={id} />
      ))}
    </footer>
  );
}

/** A piece of the status bar; each opens what it is about. */
export function StatusButton({ className, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={classNames(
        'hover-shade flex cursor-default items-center gap-1.5 px-2 whitespace-nowrap transition-colors duration-120 hover:text-ink [&_svg]:size-3',
        className,
      )}
      {...props}
    />
  );
}
