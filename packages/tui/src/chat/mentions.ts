/** `@src/app.tsx` or `@"docs/release notes.md"`, at the start of the text or after whitespace, so emails don't count. */
export const MENTION = /(?<=^|\s)@(?:"[^"\n]+"|[^\s"]+)/g;

/** How a path goes into the prompt; paths with spaces are quoted. */
export const mention = (path: string) => (/\s/.test(path) ? `@"${path}"` : `@${path}`);

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Mentions of known names after `sigil`, such as `$design` for a skill, for prompts and user messages to highlight.
 * Only the names count, so `$HOME` in a shell command stays plain. Trailing punctuation is left out.
 */
export function namedMention(sigil: string, names: string[]): RegExp | undefined {
  if (names.length === 0) return undefined;
  // Longest first, so `$design-system` doesn't stop at `$design`.
  const alternatives = [...names].sort((a, b) => b.length - a.length).map(escapeRegExp).join('|');
  return new RegExp(`(?<=^|\\s)${escapeRegExp(sigil)}(?:${alternatives})(?=$|[\\s.,;!?)])`, 'g');
}

/** One pattern that matches what any of `patterns` matches, for props that take a single one. */
export function anyOf(patterns: (RegExp | undefined)[]): RegExp | undefined {
  const present = patterns.filter((pattern): pattern is RegExp => pattern !== undefined);
  if (present.length <= 1) return present[0];
  return new RegExp(present.map((pattern) => `(?:${pattern.source})`).join('|'), 'g');
}
