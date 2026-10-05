import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { classNames } from '../lib/class-names.js';

export interface WorkLineProps {
  children: ReactNode;
  open?: boolean;
  /** Without it, the line only says what happened and doesn't open. */
  onToggle?: () => void;
}

/** One quiet line for something the agent did, such as `Explored 4 files` or `Ran the tests 4.2s`, opened on a click. */
export function WorkLine({ children, open, onToggle }: WorkLineProps) {
  if (!onToggle) return <div className="flex min-h-7 min-w-0 items-center gap-2 text-muted">{children}</div>;

  return (
    <button type="button" onClick={onToggle} className="group flex min-h-7 max-w-full min-w-0 cursor-default items-center gap-2 self-start text-left text-muted hover:text-ink">
      {children}
      <ChevronRight className={classNames('size-4 shrink-0 text-faint transition-transform duration-150 group-hover:text-muted', open && 'rotate-90')} />
    </button>
  );
}
