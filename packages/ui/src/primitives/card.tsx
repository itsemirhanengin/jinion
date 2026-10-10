import type { ReactNode } from 'react';

export interface CardProps {
  title: ReactNode;
  /** Beside the title, faint, such as a count or an address. */
  detail?: ReactNode;
  /** What the card opens, at its end, such as Open or Review. */
  action?: string;
  onAction?: () => void;
  children?: ReactNode;
}

/** A white card of its own: its title, anything about it faint beside it, what it opens at the end, and what it shows under a line. */
export function Card({ title, detail, action, onAction, children }: CardProps) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl bg-background shadow-xs ring-1 ring-edge">
      <div className="flex h-10 shrink-0 items-center gap-2 pr-2 pl-3.5">
        <div className="flex min-w-0 shrink items-center gap-2 font-medium">{title}</div>
        <span className="min-w-0 flex-1 truncate text-faint">{detail}</span>
        {action && (
          <button type="button" onClick={onAction} className="h-7 shrink-0 cursor-default rounded-full px-2.5 font-medium hover:bg-shade">
            {action}
          </button>
        )}
      </div>
      {children && <div className="border-t border-line">{children}</div>}
    </section>
  );
}
