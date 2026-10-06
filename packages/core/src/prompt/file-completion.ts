import { fuzzyMatch } from '../lib/fuzzy.js';
import type { CompletionItem, CompletionSource } from './completion.js';
import { mention } from './mentions.js';

const SHOWN = 50;

const AT_CURSOR = /(?:^|\s)@([^\s"]*)$/;

/** Claude Code reads `@path` mentions itself. A folder gets no trailing space, so typing on lists what is inside. */
export function fileCompletion(files: string[]): CompletionSource {
  return (value, cursor) => {
    const typed = AT_CURSOR.exec(value.slice(0, cursor));
    if (!typed) return undefined;

    const query = typed[1]!;

    const items: CompletionItem[] = rank(files, query)
      .slice(0, SHOWN)
      .map(({ path, positions }) => {
        const folder = path.endsWith('/');

        return { key: path, label: path, positions, insert: folder ? mention(path) : `${mention(path)} `, tag: folder ? 'dir' : undefined };
      });

    return items.length > 0 ? { from: cursor - query.length - 1, to: cursor, items, submit: false } : undefined;
  };
}

function rank(files: string[], query: string) {
  if (!query) return files.filter((path) => !path.slice(0, -1).includes('/')).map((path) => ({ path, positions: [] }));

  return files
    .flatMap((path) => {
      // The folder typed so far is where the user already is.
      if (path === query) return [];

      const start = path.slice(0, -1).lastIndexOf('/') + 1;
      const inName = fuzzyMatch(path.slice(start), query);
      if (inName) return [{ path, score: inName.score + 10, positions: inName.positions.map((at) => at + start) }];

      const inPath = fuzzyMatch(path, query);

      return inPath ? [{ path, score: inPath.score, positions: inPath.positions }] : [];
    })
    .sort((a, b) => b.score - a.score || a.path.length - b.path.length);
}
