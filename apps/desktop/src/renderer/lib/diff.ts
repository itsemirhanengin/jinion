import type { DiffLine } from '@jinion/ui/chat';

const GIT_HEADER = /^(diff --git |index |--- |\+\+\+ |new file mode|deleted file mode|old mode|new mode|similarity index|rename from|rename to|Binary files)/;

/** A unified patch's lines with their numbers, without its hunk headers; a gap between hunks shows as an empty line. */
export function diffLines(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let at: { before: number; after: number } | undefined;

  for (const line of patch.replace(/\n$/, '').split('\n')) {
    // Git's own diff starts with headers, `+++ b/file` among them, before its first hunk.
    if (!at && GIT_HEADER.test(line)) continue;

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
