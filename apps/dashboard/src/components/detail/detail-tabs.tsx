'use client';

export type DetailTab<T extends string> = { id: T; label: string; count?: number };

/** A detail page's sections, styled like a list's saved view tabs. */
export function DetailTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: DetailTab<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto border-b border-neutral-950/8 px-4 pb-3 sm:mx-0 sm:px-0">
      <ul role="list" className="flex w-max gap-1">
        {tabs.map((tab) => (
          <li key={tab.id}>
            <button
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={tab.id === value ? 'page' : undefined}
              className="rounded-lg px-2.5 py-1 font-medium whitespace-nowrap text-neutral-600 hover:bg-neutral-950/5 hover:text-neutral-950 aria-[current=page]:bg-neutral-950/8 aria-[current=page]:text-neutral-950"
            >
              {tab.label}
              {tab.count !== undefined && <span className="ml-1 font-normal text-neutral-500 tabular-nums">{tab.count.toLocaleString('en-US')}</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
