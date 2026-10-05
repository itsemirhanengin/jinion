import type { ReactNode } from 'react';

export interface PageProps {
  title: string;
  description?: string;
  /** At the end of the title row, such as a search or a button. */
  actions?: ReactNode;
  children: ReactNode;
}

/** A screen of its own in a tab, such as the memory or the skills. */
export function Page({ title, description, actions, children }: PageProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-190 flex-col gap-6 px-8 py-8">
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="text-title font-semibold text-balance">{title}</h1>
            {description && <p className="max-w-[60ch] text-pretty text-muted">{description}</p>}
          </div>
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}

/** Rows one above the other, a line between them. */
export function List({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl bg-background ring-1 ring-edge">{children}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-raised px-6 py-10 text-center text-pretty text-muted ring-1 ring-edge">{children}</div>;
}
