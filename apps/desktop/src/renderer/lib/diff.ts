import type { DiffLine } from '@jinion/ui/chat';

/** A unified patch's lines with their numbers, without its hunk headers; a gap between hunks shows as an empty line. */
export function diffLines(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let at: { before: number; after: number } | undefined;

  for (const line of patch.split('\n')) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);

    if (hunk) {
      if (lines.length > 0) lines.push({ kind: 'context', text: '' });
      at = { before: Number(hunk[1]), after: Number(hunk[2]) };
    } else if (line.startsWith('+')) {
      lines.push({ kind: 'added', text: line.slice(1), number: at && at.after++ });
    } else if (line.startsWith('-')) {
      lines.push({ kind: 'removed', text: line.slice(1), number: at && at.before++ });
    } else if (!line.startsWith('\\') && !line.startsWith('@@')) {
      lines.push({ kind: 'context', text: line.slice(1), number: at?.after });

      if (at) {
        at.before++;
        at.after++;
      }
    }
  }

  return lines;
}
