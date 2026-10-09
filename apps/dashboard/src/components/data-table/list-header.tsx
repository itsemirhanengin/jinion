'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { primaryButton, secondaryButton } from '@/components/data-table/buttons';
import { PageHeader } from '@/components/page';

// Secondary actions are hidden on mobile to keep the header on one line.
export type HeaderAction = { label: string; icon: LucideIcon; primary?: boolean; onClick?: () => void; href?: string };

/** A list page's top bar: its title, how many records it holds, and its actions. */
export function ListHeader({ title, icon: Icon, count, actions }: { title: string; icon: LucideIcon; count: React.ReactNode; actions: HeaderAction[] }) {
  return (
    <PageHeader>
      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <h1 className="flex items-center gap-1.5 self-center text-base/6 font-medium sm:text-sm/6">
          <Icon className="size-4 shrink-0 stroke-neutral-600" />
          {title}
        </h1>
        <p className="truncate text-sm/6 text-neutral-500 tabular-nums sm:text-xs/6">{count}</p>
      </div>
      <div className="flex items-center gap-2">
        {actions.map((action) => {
          const className = `flex items-center gap-1.5 py-1 pr-2.5 pl-1.5 text-sm/5 ${action.primary ? primaryButton : `max-sm:hidden ${secondaryButton}`}`;

          const content = (
            <>
              <action.icon className="size-4 shrink-0" />
              {action.label}
            </>
          );

          return action.href ? (
            <Link transitionTypes={['nav-forward']} key={action.label} href={action.href} className={className}>
              {content}
            </Link>
          ) : (
            <button key={action.label} type="button" onClick={action.onClick} className={className}>
              {content}
            </button>
          );
        })}
      </div>
    </PageHeader>
  );
}
