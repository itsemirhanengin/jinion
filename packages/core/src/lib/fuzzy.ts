export interface FuzzyMatch<T> {
  item: T;
  score: number;
  positions: number[];
}

const SEPARATORS = new Set([' ', '-', '_', '/', ':', '.']);

export function fuzzyMatch(text: string, query: string): { score: number; positions: number[] } | undefined {
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const positions: number[] = [];
  let score = 0;
  let from = 0;

  for (const char of needle) {
    if (char === ' ') continue;

    const index = haystack.indexOf(char, from);
    if (index === -1) return undefined;

    const previous = positions.at(-1);

    score += 1;
    if (previous !== undefined && index === previous + 1) score += 3;
    if (index === 0 || SEPARATORS.has(haystack[index - 1]!)) score += 5;
    if (previous !== undefined) score -= Math.min(3, index - previous - 1);

    positions.push(index);
    from = index + 1;
  }

  return { score, positions };
}

export function fuzzyFilter<T>(items: T[], query: string, text: (item: T) => string): FuzzyMatch<T>[] {
  if (!query.trim()) return items.map((item) => ({ item, score: 0, positions: [] }));

  return items
    .flatMap((item, order) => {
      const match = fuzzyMatch(text(item), query);

      return match ? [{ item, order, ...match }] : [];
    })
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ item, score, positions }) => ({ item, score, positions }));
}
