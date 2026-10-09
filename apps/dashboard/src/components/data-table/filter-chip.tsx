'use client';

import { useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { touchTarget } from '@/components/page';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ActiveFilter, FilterDef } from '@/lib/data-table';

const SEARCH_THRESHOLD = 6;

export function FilterChip({
  def,
  filter,
  autoOpen,
  onChange,
  onRemove,
}: {
  def: Omit<FilterDef<unknown>, 'test'>;
  filter: ActiveFilter;
  autoOpen: boolean;
  onChange: (values: string[]) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [search, setSearch] = useState('');

  const lower = search.trim().toLocaleLowerCase('tr');
  const options = lower ? def.options.filter((option) => option.label.toLocaleLowerCase('tr').includes(lower)) : def.options;
  const selected = filter.values.map((value) => def.options.find((option) => option.value === value)?.label ?? value);

  function handleOpenChange(next: boolean) {
    setOpen(next);

    if (!next) {
      setSearch('');
      if (filter.values.length === 0) onRemove();
    }
  }

  function toggle(value: string) {
    if (!def.multiple) {
      onChange([value]);
      setOpen(false);

      return;
    }

    onChange(filter.values.includes(value) ? filter.values.filter((other) => other !== value) : [...filter.values, value]);
  }

  return (
    <li className="flex items-center rounded-lg bg-neutral-950/5 text-sm/5">
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger className="flex max-w-72 items-center gap-1 rounded-l-lg py-1 pl-2.5 hover:bg-neutral-950/5 data-popup-open:bg-neutral-950/5">
          <span className="shrink-0 text-neutral-500">{def.label}:</span>
          <span className={`truncate ${filter.values.length ? '' : 'text-neutral-500'}`}>{summary(selected)}</span>
          <ChevronDown className="size-4 shrink-0 stroke-neutral-500" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 gap-0 p-0">
          <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
            <p className="text-sm/5 font-medium">{def.label}</p>
            {def.multiple && filter.values.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="rounded-md px-1.5 text-sm/5 text-neutral-500 hover:bg-neutral-950/5 hover:text-neutral-950"
              >
                Clear
              </button>
            )}
          </div>

          {def.options.length >= SEARCH_THRESHOLD && (
            <div className="relative px-2 pb-1">
              <Search className="pointer-events-none absolute top-1/2 left-4.5 size-4 -translate-y-1/2 stroke-neutral-400" />
              <input
                type="search"
                name={`${def.key}-search`}
                aria-label={`Search ${def.label}`}
                // biome-ignore lint/a11y/noAutofocus: the search is what the person came to the popover for.
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search"
                className="w-full rounded-md bg-neutral-950/5 py-1.5 pr-2 pl-8 text-base/5 placeholder:text-neutral-400 focus:outline-2 focus:-outline-offset-1 focus:outline-neutral-950 sm:text-sm/5"
              />
            </div>
          )}

          <div className="max-h-80 overflow-y-auto p-1">
            <ul role="list" className="flex flex-col">
              {options.map((option) => {
                const id = `${def.key}-${option.value}`;
                const checked = filter.values.includes(option.value);

                return (
                  <li key={option.value}>
                    <label htmlFor={id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm/5 hover:bg-neutral-950/5">
                      <span className="flex h-lh items-center">
                        {def.multiple ? (
                          <Checkbox id={id} name={def.key} checked={checked} onChange={() => toggle(option.value)} />
                        ) : (
                          <span className="group inline-grid size-5 grid-cols-1 sm:size-4">
                            <input
                              id={id}
                              type="radio"
                              name={def.key}
                              checked={checked}
                              onChange={() => toggle(option.value)}
                              className="col-start-1 row-start-1 appearance-none rounded-full border border-neutral-300 bg-white checked:border-neutral-950 checked:bg-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 forced-colors:appearance-auto"
                            />
                            <span className="pointer-events-none col-start-1 row-start-1 size-[round(down,40%,1px)] self-center justify-self-center rounded-full bg-white group-not-has-checked:opacity-0" />
                          </span>
                        )}
                      </span>
                      <span className="min-w-0 truncate">
                        {option.label}
                        {option.detail && <span className="text-neutral-500"> · {option.detail}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {options.length === 0 && <p className="px-2 py-1.5 text-sm/5 text-neutral-500">No results.</p>}
          </div>
        </PopoverContent>
      </Popover>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove the ${def.label} filter`}
        className="relative grid size-7 place-items-center rounded-r-lg text-neutral-500 hover:bg-neutral-950/5 hover:text-neutral-950"
      >
        <X className="size-4 shrink-0" />
        {touchTarget}
      </button>
    </li>
  );
}

function summary(labels: string[]) {
  if (labels.length === 0) return 'Choose';
  if (labels.length <= 2) return labels.join(', ');

  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
}
