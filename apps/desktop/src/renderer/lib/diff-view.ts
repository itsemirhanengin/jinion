import type { DiffLine } from '@jinion/ui/chat';

/** How many lines a diff shows before it is opened in full. */
export const SHOWN_LINES = 300;

/** A line longer than this, as in a minified file, is cut where it is drawn. */
const LONGEST = 4000;

const LINE = 20;
const CHROME = 36 + 12;
const SHOW_ALL = 36;

/** The diff's lines as a card draws them: one too long to lay out cut short, the rest as they are. */
export function drawable(lines: DiffLine[]) {
  return lines.map((line) => (line.text.length > LONGEST ? { ...line, text: `${line.text.slice(0, LONGEST)} …` } : line));
}

/** How tall a diff's card likely is before it is drawn, from its counts, folded at `SHOWN_LINES`. */
export function diffHeight(insertions: number, deletions: number) {
  const lines = insertions + deletions + 6;

  return CHROME + Math.min(lines, SHOWN_LINES) * LINE + (lines > SHOWN_LINES ? SHOW_ALL : 0);
}
