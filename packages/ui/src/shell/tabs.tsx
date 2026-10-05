import { X } from 'lucide-react';
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
  /** Shows a close button on hover and on the active tab. */
  onClose?: () => void;
}

export function Tab({ title, status, added = 0, removed = 0, badge, active, onClick, onClose }: TabProps) {
  return (
    <div
      className={classNames(
        'group flex h-8 max-w-60 min-w-0 shrink items-center rounded-full transition-colors',
        active ? 'bg-hover text-ink' : 'text-ink/75 hover:bg-hover/60 hover:text-ink',
      )}
    >
      <button type="button" onClick={onClick} className="flex h-full min-w-0 cursor-default items-center gap-2 pr-1 pl-3">
        {status && <StatusIcon status={status} />}
        <span className="min-w-0 truncate">{title}</span>
        <LineCounts added={added} removed={removed} />
        {badge && <span className="shrink-0 text-small text-accent">{badge}</span>}
      </button>
      {onClose ? (
        <button
          type="button"
          aria-label={`Close ${title}`}
          onClick={onClose}
          className={classNames(
            'mr-1.5 flex size-5 shrink-0 cursor-default items-center justify-center rounded-full text-faint hover:bg-line hover:text-ink',
            !active && 'opacity-0 group-hover:opacity-100',
          )}
        >
          <X className="size-3" />
        </button>
      ) : (
        <span className="w-2" />
      )}
    </div>
  );
}
