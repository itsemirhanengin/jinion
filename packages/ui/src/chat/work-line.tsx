import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { classNames } from '../lib/class-names.js';

export interface WorkLineProps {
  /** A small icon in a column of its own, so the lines and what opens under them line up. */
  icon?: ReactNode;
  children: ReactNode;
  open?: boolean;
  /** Without it, the line only says what happened and doesn't open. */
  onToggle?: () => void;
  /** Still going on, such as Thinking: a light passes over its words. */
  active?: boolean;
}

/** One quiet line for something the agent did, such as `Read server.ts` or `Ran pnpm test 4.2s`, opened on a click. */
export function WorkLine({ icon, children, open, onToggle, active }: WorkLineProps) {
  const content = (
    <>
      {icon && <span className="flex size-4 shrink-0 items-center justify-center text-faint [&_svg]:size-3.5">{icon}</span>}
      <span className={classNames('flex min-w-0 items-center gap-1.5', active && 'shimmer')}>{children}</span>
    </>
  );

  if (!onToggle) return <div className="flex h-7 min-w-0 items-center gap-2 text-muted">{content}</div>;

  return (
    <button type="button" onClick={onToggle} className="group flex h-7 max-w-full min-w-0 cursor-default items-center gap-2 self-start text-left text-muted hover:text-ink">
      {content}
      <ChevronRight className={classNames('size-3.5 shrink-0 text-faint opacity-0 transition group-hover:opacity-100', open && 'rotate-90 opacity-100')} />
    </button>
  );
}

/** What a line opens to, under its words rather than its icon, with no rule beside it. */
export function WorkBody({ children }: { children: ReactNode }) {
  return <div className="animate-enter pt-0.5 pb-2 pl-6">{children}</div>;
}
