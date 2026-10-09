import Link from 'next/link';
import { ChevronLeft, type LucideIcon } from 'lucide-react';

/** The bar along the top of every page, under which the page scrolls. */
export function PageHeader({ children }: { children: React.ReactNode }) {
  return <header className="flex items-center gap-3 border-b border-neutral-950/5 px-4 py-3 sm:px-6 lg:px-8">{children}</header>;
}

/** The page's scrolling area. `className` sets the bottom padding, which depends on what floats over the page. */
export function PageBody({ className, children }: { className: string; children: React.ReactNode }) {
  return <div className={`min-h-0 flex-1 overflow-auto px-4 text-sm/5 sm:px-6 sm:text-[0.8125rem]/5 lg:px-8 ${className}`}>{children}</div>;
}

/** Makes a small button easy to hit on touch screens without growing it. */
export const touchTarget = (
  <span className="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden" aria-hidden="true" />
);

/** The way back to a section's list: a round button and the section's name. */
export function BackLink({ section, href, icon: Icon }: { section: string; href: string; icon: LucideIcon }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <Link
        transitionTypes={['nav-back']}
        href={href}
        aria-label={`Back to ${section}`}
        className="relative grid size-7 shrink-0 place-items-center rounded-full bg-white text-neutral-700 ring-1 shadow-xs ring-neutral-950/10 hover:bg-neutral-50 hover:text-neutral-950"
      >
        <ChevronLeft className="size-4 shrink-0" />
        {touchTarget}
      </Link>
      <Link
        transitionTypes={['nav-back']}
        href={href}
        className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 text-sm/6 text-neutral-600 hover:text-neutral-950"
      >
        <Icon className="size-4 shrink-0" />
        <span className="truncate">{section}</span>
      </Link>
    </div>
  );
}
