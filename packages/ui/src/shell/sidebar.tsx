import type { ReactNode } from 'react';
import { classNames } from '../lib/class-names.js';

export function Sidebar({ children }: { children: ReactNode }) {
  return <aside className="flex w-72 shrink-0 flex-col border-r border-line bg-sidebar">{children}</aside>;
}

/** The sidebar's top row, which leaves room for the window's traffic lights and moves the window when dragged. */
export function SidebarHeader({ children }: { children?: ReactNode }) {
  return (
    <div className="flex h-13 shrink-0 items-center gap-1 pr-3 pl-20 [-webkit-app-region:drag] [&_button]:[-webkit-app-region:no-drag]">
      {children}
    </div>
  );
}

export function SidebarSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-px px-3 pb-3">
      {title && <h2 className="px-2.5 pt-3 pb-1.5 text-muted">{title}</h2>}
      {children}
    </section>
  );
}

export interface SidebarItemProps {
  icon?: ReactNode;
  label: string;
  /** Muted, at the end of the row, such as how long ago a thread last changed. */
  trailing?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export function SidebarItem({ icon, label, trailing, active, onClick }: SidebarItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        'flex h-8 w-full cursor-default items-center gap-2.5 rounded-lg px-2.5 text-left transition-colors [&>svg]:size-4 [&>svg]:shrink-0',
        active ? 'bg-hover text-ink' : 'text-ink/85 hover:bg-hover/70',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing && <span className="shrink-0 text-small text-faint">{trailing}</span>}
    </button>
  );
}
