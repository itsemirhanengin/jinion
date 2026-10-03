export interface Span {
  start: number;
  end: number;
}

export interface Mark extends Span {
  atom: boolean;
}

export const spansOf = (value: string, pattern: RegExp | undefined): Span[] =>
  pattern ? [...value.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length })) : [];

export const marksOf = (value: string, atoms: Span[], highlight: RegExp | undefined): Mark[] => [
  ...atoms.map((span) => ({ ...span, atom: true })),
  ...spansOf(value, highlight)
    .filter((span) => !atoms.some((atom) => atom.start < span.end && span.start < atom.end))
    .map((span) => ({ ...span, atom: false })),
];
