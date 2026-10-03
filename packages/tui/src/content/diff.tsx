import { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useTheme, useView } from '../runtime/context.js';
import { printable } from '../utils/printable.js';
import { ExpandHint } from './output.js';

export type DiffLineKind = 'context' | 'added' | 'removed' | 'gap';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  oldNumber?: number;
  newNumber?: number;
  /** Changed span within a modified line, as `[start, end)` character offsets. */
  highlight?: [number, number];
}

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/** Parses the hunks of a unified diff. File headers and `\ No newline` markers are skipped. */
export function parsePatch(patch: string): DiffLine[] {
  const lines: DiffLine[] = [];
  let oldNumber = 1;
  let newNumber = 1;
  let inHunk = false;

  for (const raw of patch.replace(/\n$/, '').split('\n')) {
    const hunk = HUNK_HEADER.exec(raw);
    if (hunk) {
      if (lines.length > 0) lines.push({ kind: 'gap', text: '' });
      oldNumber = Number(hunk[1]);
      newNumber = Number(hunk[2]);
      inHunk = true;
      continue;
    }
    if (!inHunk || raw.startsWith('\\')) continue;

    // Tab stops count from the line's own start, after the +/- column.
    const text = printable(raw.slice(1));
    if (raw.startsWith('+')) lines.push({ kind: 'added', text, newNumber: newNumber++ });
    else if (raw.startsWith('-')) lines.push({ kind: 'removed', text, oldNumber: oldNumber++ });
    else lines.push({ kind: 'context', text, oldNumber: oldNumber++, newNumber: newNumber++ });
  }

  highlightModifiedLines(lines);
  return lines;
}

export function countChanges(lines: DiffLine[]) {
  return {
    added: lines.filter((line) => line.kind === 'added').length,
    removed: lines.filter((line) => line.kind === 'removed').length,
  };
}

/** Pairs equal-length runs of removed and added lines and marks the span that differs. */
function highlightModifiedLines(lines: DiffLine[]) {
  for (let start = 0; start < lines.length; ) {
    let middle = start;
    while (lines[middle]?.kind === 'removed') middle++;
    let end = middle;
    while (lines[end]?.kind === 'added') end++;

    if (middle - start > 0 && middle - start === end - middle) {
      for (let offset = 0; offset < middle - start; offset++) {
        const removed = lines[start + offset]!;
        const added = lines[middle + offset]!;
        const [prefix, suffix] = commonEnds(removed.text, added.text);
        if (prefix + suffix === 0) continue;
        removed.highlight = [prefix, removed.text.length - suffix];
        added.highlight = [prefix, added.text.length - suffix];
      }
    }
    start = Math.max(end, start + 1);
  }
}

function commonEnds(a: string, b: string): [number, number] {
  const limit = Math.min(a.length, b.length);
  let prefix = 0;
  while (prefix < limit && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (suffix < limit - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix++;
  return [prefix, suffix];
}

export interface DiffProps {
  patch: string;
  /** Lines shown while collapsed. */
  maxLines?: number;
  /** Only these lines, one row each, cut at the edge: for a view that scrolls through a long diff. */
  window?: { start: number; rows: number };
}

/**
 * Renders a unified diff with a line number gutter:
 *
 *     | 12|unchanged
 *     |-13|removed
 *     |+13|added
 */
export function Diff({ patch, maxLines = 24, window }: DiffProps) {
  const theme = useTheme();
  const { expanded } = useView();
  const lines = useMemo(() => parsePatch(patch), [patch]);
  const visible = window
    ? lines.slice(window.start, window.start + window.rows)
    : expanded
      ? lines
      : lines.slice(0, maxLines);
  const numberWidth = String(Math.max(0, ...lines.map((line) => line.newNumber ?? line.oldNumber ?? 0))).length;

  return (
    <Box flexDirection="column">
      {visible.map((line, index) => {
        if (line.kind === 'gap') {
          return (
            <Text key={index} color={theme.muted}>
              …
            </Text>
          );
        }

        const style = {
          context: { sign: ' ', color: undefined, background: undefined, highlight: undefined },
          added: { sign: '+', color: theme.diff.added, background: theme.diff.addedBg, highlight: theme.diff.addedHighlight },
          removed: { sign: '-', color: theme.diff.removed, background: theme.diff.removedBg, highlight: theme.diff.removedHighlight },
        }[line.kind];
        const number = line.kind === 'removed' ? line.oldNumber : line.newNumber;
        const [from, to] = line.highlight ?? [line.text.length, line.text.length];

        return (
          <Box key={index} backgroundColor={style.background}>
            <Box flexShrink={0}>
              <Text color={style.color ?? theme.muted}>
                {style.sign}
                {String(number ?? '').padStart(numberWidth)}
              </Text>
              <Text color={theme.border}>|</Text>
            </Box>
            <Box flexShrink={1}>
              <Text color={style.color} wrap={window ? 'truncate-end' : 'wrap'}>
                {line.text.slice(0, from)}
                <Text backgroundColor={style.highlight}>{line.text.slice(from, to)}</Text>
                {line.text.slice(to) || (line.text ? '' : ' ')}
              </Text>
            </Box>
          </Box>
        );
      })}
      {!window && visible.length < lines.length && <ExpandHint>{`+${lines.length - visible.length} more ${lines.length - visible.length === 1 ? 'line' : 'lines'}`}</ExpandHint>}
    </Box>
  );
}
