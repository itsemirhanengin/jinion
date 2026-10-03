/** Only at the start or after whitespace, so emails don't count. */
export const MENTION = /(?<=^|\s)@(?:"[^"\n]+"|[^\s"]+)/g;

export const mention = (path: string) => (/\s/.test(path) ? `@"${path}"` : `@${path}`);

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Only the given names count, so `$HOME` in a shell command stays plain. */
export function namedMention(sigil: string, names: string[]): RegExp | undefined {
  if (names.length === 0) return undefined;
  // Longest first, so `$design-system` doesn't stop at `$design`.
  const alternatives = [...names].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
  return new RegExp(`(?<=^|\\s)${escapeRegExp(sigil)}(?:${alternatives})(?=$|[\\s.,;!?)])`, 'g');
}

export function anyOf(patterns: (RegExp | undefined)[]): RegExp | undefined {
  const present = patterns.filter((pattern): pattern is RegExp => pattern !== undefined);
  if (present.length <= 1) return present[0];
  return new RegExp(present.map((pattern) => `(?:${pattern.source})`).join('|'), 'g');
}
