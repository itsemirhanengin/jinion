import type { ReactNode } from 'react';
import { classNames } from '../lib/class-names.js';
import { LineCounts } from '../primitives/line-counts.js';
import { type Status, StatusIcon } from '../primitives/status-icon.js';

export function Tabs({ children }: { children: ReactNode }) {
  return <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden">{children}</nav>;
}

export interface TabProps {
  title: string;
  /** Left out for a conversation that hasn't started. */
  status?: Status;
  added?: number;
  removed?: number;
  /** A short word after the title, such as `New`. */
  badge?: string;
  active?: boolean;
  onClick?: () => void;
}

export function Tab({ title, status, added = 0, removed = 0, badge, active, onClick }: TabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        'flex h-8 max-w-60 min-w-0 shrink cursor-default items-center gap-2 rounded-full px-3 transition-colors',
        active ? 'bg-hover text-ink' : 'text-ink/75 hover:bg-hover/60 hover:text-ink',
      )}
    >
      {status && <StatusIcon status={status} />}
      <span className="min-w-0 truncate">{title}</span>
      <LineCounts added={added} removed={removed} />
      {badge && <span className="shrink-0 text-small text-accent">{badge}</span>}
    </button>
  );
}
