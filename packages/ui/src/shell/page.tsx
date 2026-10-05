import type { ReactNode } from 'react';

export interface PageProps {
  title: string;
  description?: string;
  /** At the end of the title row, such as a search or a button. */
  actions?: ReactNode;
  children: ReactNode;
}

/** A screen of its own in the window's middle, such as the memory or the skills. */
export function Page({ title, description, actions, children }: PageProps) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-200 flex-col gap-5 px-8 pt-6 pb-12">
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="text-xl font-semibold">{title}</h1>
            {description && <p className="text-muted">{description}</p>}
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}

/** A box of rows, one above the other with a line between. */
export function List({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-raised">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center text-muted">{children}</div>;
}
