'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronsUpDown, ListFilter, type LucideIcon, Search } from 'lucide-react';
import { ColumnsPopover } from '@/components/data-table/columns-popover';
import { FilterChip } from '@/components/data-table/filter-chip';
import { type HeaderAction, ListHeader } from '@/components/data-table/list-header';
import { Pagination } from '@/components/data-table/pagination';
import { PageBody } from '@/components/page';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  type ActiveFilter,
  type Column,
  type ListConfig,
  paramsOf,
  parseListState,
  queryRows,
  type SavedView,
  serializeListState,
} from '@/lib/data-table';
import { formatCount, formatPercent } from '@/lib/format';

const PAGE_SIZE = 50;

export type DataTableProps<T> = {
  title: string;
  /** The page's icon, the same one as in the sidebar. */
  icon: LucideIcon;
  /** What a row is, in counts: `["user", "users"]`. */
  unit: [string, string];
  actions?: HeaderAction[];
  rows: T[];
  getRowId: (row: T) => string;
  /** The always-visible first column; it links to the row's detail page, which receives the list state. */
  primary: { label: string; text: (row: T) => React.ReactNode; href: (row: T) => string };
  columns: Column<T>[];
  defaultVisible: string[];
  list: ListConfig<T>;
  /** Rendered above the controls with every row, e.g. a strip of figures. */
  insights?: (rows: T[]) => React.ReactNode;
  search: { label: string; placeholder: string };
  emptyText: string;
};

export function DataTable<T>({
  title,
  icon,
  unit,
  actions = [],
  rows: allRows,
  getRowId,
  primary,
  columns,
  defaultVisible,
  list,
  insights,
  search,
  emptyText,
}: DataTableProps<T>) {
  const searchParams = useSearchParams();

  const [initial] = useState(() => parseListState(paramsOf(searchParams), list));
  const [activeViewId, setActiveViewId] = useState(initial.viewId);
  const [filters, setFilters] = useState<ActiveFilter[]>(initial.filters);
  const [query, setQuery] = useState(initial.query);
  const [sort, setSort] = useState(initial.sort);
  const [order, setOrder] = useState(columns.map((column) => column.key));
  const [visible, setVisible] = useState(defaultVisible);
  const [page, setPage] = useState(0);
  const [newFilterKey, setNewFilterKey] = useState<string | null>(null);

  const views = list.views;
  const activeView = views.find((view) => view.id === activeViewId) ?? views[0];
  const viewChanged = !sameFilters(filters, activeView.filters);
  const hasFilters = meaningful(filters).length > 0;
  const listQuery = serializeListState({ viewId: activeViewId, filters, query, sort }, list);
  const rows = useMemo(() => queryRows(allRows, { filters, query, sort }, list), [allRows, filters, query, sort, list]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const shownColumns = order.filter((key) => visible.includes(key)).map((key) => columns.find((column) => column.key === key)!);
  const count = (n: number) => `${formatCount(n)} ${n === 1 ? unit[0] : unit[1]}`;

  // The list's state is mirrored in the URL, so a detail page can step through the same rows and come back to them.
  useEffect(() => {
    window.history.replaceState(null, '', listQuery ? `?${listQuery}` : window.location.pathname);
  }, [listQuery]);

  function applyFilters(next: ActiveFilter[]) {
    setFilters(next);
    setPage(0);
  }

  function openView(view: SavedView) {
    setNewFilterKey(null);
    setActiveViewId(view.id);
    applyFilters(view.filters);
  }

  return (
    <>
      <ListHeader title={title} icon={icon} count={count(allRows.length)} actions={actions} />

      <PageBody className="@container pb-24">
        {/* Keeps the controls pinned horizontally when a wide table scrolls sideways. */}
        <div className="sticky left-0 flex w-[100cqw] flex-col gap-3 pt-4 pb-3">
          {insights?.(allRows)}
          <nav aria-label="Saved views" className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <ul role="list" className="flex w-max gap-1">
              {views.map((view) => (
                <li key={view.id} className="flex items-center rounded-lg">
                  <button
                    type="button"
                    onClick={() => openView(view)}
                    aria-current={view.id === activeViewId ? 'page' : undefined}
                    className="rounded-lg px-2.5 py-1 font-medium whitespace-nowrap text-neutral-600 hover:bg-neutral-950/5 hover:text-neutral-950 aria-[current=page]:bg-neutral-950/8 aria-[current=page]:text-neutral-950"
                  >
                    {view.name}
                    {view.id === activeViewId && viewChanged && <span className="font-normal text-neutral-500"> (changed)</span>}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1 rounded-lg bg-white p-1 ring-1 ring-neutral-950/10 focus-within:outline-2 focus-within:-outline-offset-1 focus-within:outline-neutral-950">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Choose a view"
                className="flex h-7 max-w-40 shrink-0 items-center gap-0.5 rounded-md bg-neutral-950/5 pr-1 pl-2 font-medium hover:bg-neutral-950/8 data-popup-open:bg-neutral-950/8"
              >
                <span className="truncate">{activeView.name}</span>
                <ChevronsUpDown className="size-4 shrink-0 stroke-neutral-500" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuRadioGroup value={activeViewId} onValueChange={(id) => openView(views.find((view) => view.id === id)!)}>
                  {views.map((view) => (
                    <DropdownMenuRadioItem key={view.id} value={view.id} closeOnClick>
                      {view.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <Search className="ml-1.5 size-4 shrink-0 stroke-neutral-500" />
            <input
              type="search"
              name="q"
              aria-label={search.label}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              placeholder={search.placeholder}
              className="min-w-0 flex-1 bg-transparent px-1 py-0.5 text-base/6 placeholder:text-neutral-500 focus:outline-hidden sm:text-[0.8125rem]/5"
            />
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Add a filter"
                className="flex h-7 shrink-0 items-center gap-1.5 rounded-md pr-2 pl-1.5 font-medium text-neutral-700 hover:bg-neutral-950/5 hover:text-neutral-950 data-popup-open:bg-neutral-950/5 max-sm:w-7 max-sm:justify-center max-sm:px-0"
              >
                <ListFilter className="size-4 shrink-0" />
                <span className="max-sm:hidden">Filter</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {list.filters
                  .filter((def) => !filters.some((filter) => filter.key === def.key))
                  .map((def) => (
                    <DropdownMenuItem
                      key={def.key}
                      onClick={() => {
                        setFilters([...filters, { key: def.key, values: [] }]);
                        setNewFilterKey(def.key);
                      }}
                    >
                      {def.label}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <ColumnsPopover
              columns={columns}
              sortFields={list.sortFields}
              order={order}
              visible={visible}
              sort={sort}
              onOrderChange={setOrder}
              onToggle={(key) => setVisible((shown) => (shown.includes(key) ? shown.filter((other) => other !== key) : [...shown, key]))}
              onSortChange={setSort}
            />
          </div>

          {(filters.length > 0 || viewChanged) && (
            <div className="flex flex-wrap items-center gap-2">
              <ul role="list" className="flex flex-wrap gap-2">
                {filters.map((filter) => (
                  <FilterChip
                    key={filter.key}
                    def={list.filters.find((def) => def.key === filter.key)!}
                    filter={filter}
                    autoOpen={filter.key === newFilterKey}
                    onChange={(values) => applyFilters(filters.map((other) => (other.key === filter.key ? { ...other, values } : other)))}
                    onRemove={() => {
                      applyFilters(filters.filter((other) => other.key !== filter.key));
                      setNewFilterKey(null);
                    }}
                  />
                ))}
              </ul>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => applyFilters([])}
                  className="rounded-md px-2 py-0.5 text-neutral-600 hover:bg-neutral-950/5 hover:text-neutral-950"
                >
                  Clear
                </button>
              )}
              <p className="ml-auto text-neutral-500 tabular-nums">
                {count(rows.length)} · {formatPercent(allRows.length ? rows.length / allRows.length : 0)}
              </p>
            </div>
          )}
        </div>

        <table className="w-full border-separate border-spacing-0 text-left whitespace-nowrap">
          <thead>
            <tr className="text-neutral-600 *:sticky *:top-2 *:z-10 *:bg-neutral-100 *:py-1.5 *:shadow-[0_-0.5rem_0_0_white] *:first:rounded-l-lg *:last:rounded-r-lg">
              <th className="px-2 pl-3 font-normal">{primary.label}</th>
              {shownColumns.map((column) => (
                <th key={column.key} className={`px-2 font-normal last:pr-3 ${column.align === 'right' ? 'text-right' : ''}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={getRowId(row)} className="*:border-b *:border-neutral-950/8 *:py-1.5">
                <td className="px-2 pl-3">
                  <Link
                    transitionTypes={['nav-forward']}
                    href={listQuery ? `${primary.href(row)}?${listQuery}` : primary.href(row)}
                    className="hover:underline"
                  >
                    {primary.text(row)}
                  </Link>
                </td>
                {shownColumns.map((column) => (
                  <td key={column.key} className={`px-2 tabular-nums last:pr-3 ${column.align === 'right' ? 'text-right' : ''}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {pageRows.length === 0 && <p className="py-12 text-center text-neutral-500">{emptyText}</p>}
      </PageBody>

      {rows.length > PAGE_SIZE && (
        <Pagination
          first={page * PAGE_SIZE + 1}
          last={Math.min((page + 1) * PAGE_SIZE, rows.length)}
          prev={{ disabled: page === 0, onClick: () => setPage(page - 1) }}
          next={{ disabled: page >= pageCount - 1, onClick: () => setPage(page + 1) }}
        />
      )}
    </>
  );
}

const meaningful = (filters: ActiveFilter[]) => filters.filter((filter) => filter.values.length > 0);

function sameFilters(a: ActiveFilter[], b: ActiveFilter[]) {
  const x = meaningful(a);
  const y = meaningful(b);

  return (
    x.length === y.length &&
    x.every((filter) => {
      const other = y.find((candidate) => candidate.key === filter.key);

      return other && other.values.length === filter.values.length && filter.values.every((value) => other.values.includes(value));
    })
  );
}
