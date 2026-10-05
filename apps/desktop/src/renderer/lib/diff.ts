import type { DiffLine } from '@jinion/ui/chat';

/** A unified patch's lines, without its hunk headers; a gap between hunks shows as an empty line. */
export function diffLines(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];

  for (const line of patch.split('\n')) {
    if (line.startsWith('@@')) {
      if (lines.length > 0) lines.push({ kind: 'context', text: '' });
    } else if (line.startsWith('+')) lines.push({ kind: 'added', text: line.slice(1) });
    else if (line.startsWith('-')) lines.push({ kind: 'removed', text: line.slice(1) });
    else if (!line.startsWith('\\')) lines.push({ kind: 'context', text: line.slice(1) });
  }

  return lines;
}
