export const mention = (path: string) => (/\s/.test(path) ? `@"${path}"` : `@${path}`);

/** Only the given names count, so `$HOME` in a shell command stays plain. */
export function namedMention(sigil: string, names: string[]): RegExp | undefined {
  if (names.length === 0) return undefined;

  // Longest first, so `$design-system` doesn't stop at `$design`.
  const alternatives = [...names].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');

  return new RegExp(`(?<=^|\\s)${escapeRegExp(sigil)}(?:${alternatives})(?=$|[\\s.,;!?)])`, 'g');
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
