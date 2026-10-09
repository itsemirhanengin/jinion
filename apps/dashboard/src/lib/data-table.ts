import type { ReactNode } from 'react';

export type Column<T> = { key: string; label: string; align?: 'right'; render: (row: T) => ReactNode };

/** `detail` tells apart options with the same label. */
export type FilterOption = { value: string; label: string; detail?: string };

export type FilterDef<T> = {
  key: string;
  label: string;
  multiple?: boolean;
  options: FilterOption[];
  test: (row: T, value: string) => boolean;
};

export type ActiveFilter = { key: string; values: string[] };

export type SortState = { key: string; dir: 'desc' | 'asc' };

export type SavedView = { id: string; name: string; filters: ActiveFilter[] };

export type SortField<T> = { key: string; label: string; kind: 'date' | 'number'; value: (row: T) => number | null };

/** What a list knows about its rows. Plain functions only, so a detail page can run the same query as the table. */
export type ListConfig<T> = {
  filters: FilterDef<T>[];
  sortFields: SortField<T>[];
  views: [SavedView, ...SavedView[]];
  defaultSort: SortState;
  searchText: (row: T) => string[];
};

export type ListState = { viewId: string; filters: ActiveFilter[]; query: string; sort: SortState };

export type SearchParams = Record<string, string | string[] | undefined>;

/** The browser's search params in the shape a page's `searchParams` has, so both sides parse the URL alike. */
export function paramsOf(search: URLSearchParams): SearchParams {
  const out: Record<string, string[]> = {};

  for (const [key, value] of search) out[key] = [...(out[key] ?? []), value];

  return out;
}

// The list's state travels in the URL, so a detail page can find its neighbours and send the user back to the same
// list: ?view=problems&f=backend:Codex|Claude&q=checkout&sort=started.asc (defaults are left out).
export function serializeListState<T>(state: ListState, config: ListConfig<T>) {
  const params = new URLSearchParams();

  if (state.viewId !== config.views[0].id) params.set('view', state.viewId);
  for (const filter of state.filters) if (filter.values.length) params.append('f', `${filter.key}:${filter.values.join('|')}`);
  if (state.query.trim()) params.set('q', state.query.trim());

  if (state.sort.key !== config.defaultSort.key || state.sort.dir !== config.defaultSort.dir) {
    params.set('sort', `${state.sort.key}.${state.sort.dir}`);
  }

  return params.toString();
}

export function parseListState<T>(params: SearchParams, config: ListConfig<T>): ListState {
  const viewId = all(params.view)[0];
  const [sortKey, sortDir] = (all(params.sort)[0] ?? '').split('.');

  const filters = all(params.f).flatMap((raw) => {
    const at = raw.indexOf(':');
    const key = raw.slice(0, at);
    const def = config.filters.find((candidate) => candidate.key === key);
    if (at < 0 || !def) return [];

    const values = raw
      .slice(at + 1)
      .split('|')
      .filter((value) => def.options.some((option) => option.value === value));

    return values.length ? [{ key, values }] : [];
  });

  const view = config.views.find((candidate) => candidate.id === viewId) ?? config.views[0];

  return {
    viewId: view.id,
    filters: params.f === undefined ? view.filters : filters,
    query: all(params.q)[0] ?? '',
    sort:
      sortKey && config.sortFields.some((field) => field.key === sortKey) && (sortDir === 'asc' || sortDir === 'desc')
        ? { key: sortKey, dir: sortDir }
        : config.defaultSort,
  };
}

export type Neighbors = { prevId: string | null; nextId: string | null; position: number | null; total: number };

/** The records on either side of the current one in the list it was opened from. */
export function neighborsOf<T>(rows: T[], id: string, state: ListState, config: ListConfig<T>, getId: (row: T) => string): Neighbors {
  const matched = queryRows(rows, state, config);
  const index = matched.findIndex((row) => getId(row) === id);
  if (index < 0) return { prevId: null, nextId: null, position: null, total: matched.length };

  return {
    prevId: index > 0 ? getId(matched[index - 1]!) : null,
    nextId: index < matched.length - 1 ? getId(matched[index + 1]!) : null,
    position: index + 1,
    total: matched.length,
  };
}

export function queryRows<T>(rows: T[], state: Pick<ListState, 'filters' | 'query' | 'sort'>, config: ListConfig<T>) {
  const query = normalize(state.query);
  const field = config.sortFields.find((candidate) => candidate.key === state.sort.key) ?? config.sortFields[0]!;
  const value = (row: T) => field.value(row) ?? -1;

  return rows
    .filter(
      (row) =>
        state.filters.every((filter) => {
          const def = config.filters.find((candidate) => candidate.key === filter.key);

          return !def || filter.values.length === 0 || filter.values.some((wanted) => def.test(row, wanted));
        }) && (!query || config.searchText(row).some((text) => normalize(text).includes(query))),
    )
    .sort((a, b) => (state.sort.dir === 'desc' ? value(b) - value(a) : value(a) - value(b)));
}

const all = (value: string | string[] | undefined) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

const normalize = (text: string) => text.toLocaleLowerCase('tr').replace(/\s/g, '');
