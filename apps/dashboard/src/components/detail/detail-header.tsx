'use client';

import Link from 'next/link';
import { ChevronDown, ChevronUp, type LucideIcon } from 'lucide-react';
import { BackLink, PageHeader, touchTarget } from '@/components/page';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatCount } from '@/lib/format';

export type DetailNav = {
  backHref: string;
  prevHref: string | null;
  nextHref: string | null;
  position: number | null;
  total: number;
};

export type DetailAction = { label: string; destructive?: boolean; onSelect?: () => void };

export function DetailHeader({
  section,
  icon,
  nav,
  itemNoun,
  actions = [],
}: {
  section: string;
  icon: LucideIcon;
  nav: DetailNav;
  /** e.g. "user", used in the previous and next labels. */
  itemNoun: string;
  actions?: DetailAction[];
}) {
  const destructive = actions.filter((action) => action.destructive);

  return (
    <PageHeader>
      <BackLink section={section} href={nav.backHref} icon={icon} />

      <div className="flex items-center gap-2">
        {nav.position !== null && (
          <p className="text-xs/6 text-neutral-500 tabular-nums max-sm:hidden">
            {formatCount(nav.position)} / {formatCount(nav.total)}
          </p>
        )}
        {actions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 rounded-lg bg-white py-1 pr-1.5 pl-2.5 text-sm/5 font-medium ring-1 ring-neutral-950/10 hover:bg-neutral-50 data-popup-open:bg-neutral-50">
              <span className="max-sm:hidden">More actions</span>
              <span className="sm:hidden">Actions</span>
              <ChevronDown className="size-4 shrink-0 stroke-neutral-500" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {actions
                .filter((action) => !action.destructive)
                .map((action) => (
                  <DropdownMenuItem key={action.label} onClick={action.onSelect}>
                    {action.label}
                  </DropdownMenuItem>
                ))}
              {destructive.length > 0 && <DropdownMenuSeparator />}
              {destructive.map((action) => (
                <DropdownMenuItem key={action.label} variant="destructive" onClick={action.onSelect}>
                  {action.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <nav aria-label={`Previous and next ${itemNoun}`} className="flex rounded-lg bg-white ring-1 ring-neutral-950/10">
          <StepLink href={nav.prevHref} label={`Previous ${itemNoun}`} icon={ChevronUp} type="nav-prev" />
          <StepLink href={nav.nextHref} label={`Next ${itemNoun}`} icon={ChevronDown} type="nav-next" />
        </nav>
      </div>
    </PageHeader>
  );
}

function StepLink({ href, label, icon: Icon, type }: { href: string | null; label: string; icon: LucideIcon; type: string }) {
  const className = 'relative grid size-7 place-items-center rounded-md';

  if (!href) {
    return (
      <button type="button" disabled aria-label={label} className={`${className} text-neutral-300`}>
        <Icon className="size-4 shrink-0" />
      </button>
    );
  }

  return (
    <Link href={href} aria-label={label} transitionTypes={[type]} className={`${className} text-neutral-700 hover:bg-neutral-950/5 hover:text-neutral-950`}>
      <Icon className="size-4 shrink-0" />
      {touchTarget}
    </Link>
  );
}
