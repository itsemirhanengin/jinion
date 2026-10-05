import type { ReactNode } from 'react';

export interface WindowProps {
  sidebar?: ReactNode;
  /** The row at the top, beside the sidebar: tabs, and what holds for the whole window at its end. */
  top?: ReactNode;
  children: ReactNode;
}

export function Window({ sidebar, top, children }: WindowProps) {
  return (
    <div className="flex h-full min-h-0 bg-canvas">
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-13 shrink-0 items-center gap-2 px-3 [-webkit-app-region:drag] [&_button]:[-webkit-app-region:no-drag]">
          {top}
        </header>
        <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
