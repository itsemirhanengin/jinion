/** The files whose name holds the query first, then those whose folders do; folders, named with a trailing `/`, left out. */
export function filesByName(paths: string[], query: string) {
  const files = paths.filter((path) => !path.endsWith('/'));
  const named = files.filter((path) => path.slice(path.lastIndexOf('/') + 1).toLowerCase().includes(query));
  const foldered = files.filter((path) => !named.includes(path) && path.toLowerCase().includes(query));

  return [...named, ...foldered];
}
