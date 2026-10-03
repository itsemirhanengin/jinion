import { ExpandHint, printable, Text, useTheme, useView, type Status, type TreeNode } from '@jinion/tui';
import { ToolLine } from '@jinion/tui/chat';
import type { ToolRun } from '../../../agent/tools.js';
import { bytes, elapsed, plural } from '../../../lib/format.js';
import { previewTree } from './result-preview.js';

export const PREVIEW_HITS = 5;

type Run<N extends ToolRun['name']> = Extract<ToolRun, { name: N }>;

export function FetchView({ run, status, output }: { run: Run<'fetch'>; status: Status; output: string[] }) {
  const theme = useTheme();

  const { bytes: size, code, codeText } = run.result ?? {};
  const received = [size === undefined ? '' : bytes(size), [code, codeText].filter(Boolean).join(' ')].filter(Boolean).join(' - ');

  return (
    <ToolLine
      status={status}
      name="Fetch:"
      detail={
        <Text>
          <Text color={theme.code}>{printable(run.input.url)}</Text>
          {received && <Text color={theme.muted}> {received}</Text>}
        </Text>
      }
      tree={previewTree(output)}
    />
  );
}

export function SearchView({ run, status }: { run: Run<'search'>; status: Status }) {
  const theme = useTheme();
  const { expanded } = useView();

  const hits = run.result?.hits ?? [];
  const shown = expanded ? hits : hits.slice(0, PREVIEW_HITS);

  const tree: TreeNode[] = shown.map((hit) => ({
    label: (
      <Text wrap="truncate-end">
        {printable(hit.title || hit.url)} <Text color={theme.muted}>{host(hit.url)}</Text>
      </Text>
    ),
  }));

  if (hits.length > shown.length) tree.push({ label: <ExpandHint>{`+${plural(hits.length - shown.length, 'result')}`}</ExpandHint> });

  return (
    <ToolLine
      status={status}
      name="Web Search:"
      detail={
        <Text>
          <Text color={theme.code}>"{printable(run.input.query)}"</Text>
          {run.result && <Text color={theme.muted}> {searchSummary(run.result)}</Text>}
        </Text>
      }
      tree={tree}
    />
  );
}

function searchSummary({ hits, searches, durationMs }: NonNullable<Run<'search'>['result']>) {
  const parts = [plural(hits.length, 'result')];

  if (searches !== undefined && searches > 1) parts.unshift(plural(searches, 'search', 'searches'));
  if (durationMs !== undefined) parts.push(elapsed(durationMs));

  return parts.join(' - ');
}

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
