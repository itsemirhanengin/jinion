import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { touchTarget } from '@/components/page';

type Step = { disabled: boolean; onClick: () => void };

/** The floating pager at the bottom left: previous, the rows shown ("51–100"), next. */
export function Pagination({ first, last, prev, next }: { first: number; last: number; prev: Step; next: Step }) {
  return (
    <nav
      aria-label="Pages"
      className="absolute bottom-4 left-4 z-20 flex items-center gap-0.5 rounded-full bg-white p-1 text-sm/5 ring-1 shadow-lg ring-neutral-950/5 sm:left-6 sm:text-[0.8125rem]/5 lg:left-8"
    >
      <PageStep label="Previous page" icon={ChevronLeft} {...prev} />
      {/* Fixed width so the arrows stay put as the range grows (1–50, 101–150, …). */}
      <p className="min-w-24 px-2 text-center tabular-nums">
        {first}–{last}
      </p>
      <PageStep label="Next page" icon={ChevronRight} {...next} />
    </nav>
  );
}

function PageStep({ label, icon: Icon, disabled, onClick }: Step & { label: string; icon: LucideIcon }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      onClick={onClick}
      className="relative grid size-7 place-items-center rounded-full text-neutral-700 hover:bg-neutral-950/5 aria-disabled:text-neutral-300 aria-disabled:hover:bg-transparent"
    >
      <Icon className="size-4 shrink-0" />
      {touchTarget}
    </button>
  );
}
