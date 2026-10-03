import { memo } from 'react';
import { Box, Expandable, Markdown, parsePatch, useView } from '@jinion/tui';
import { Notice, Thinking } from '@jinion/tui/chat';
import type { Entry } from '../../conversation/entries.js';
import { elapsed } from '../../lib/format.js';
import { Banner } from '../banner.js';
import { ChangesCard } from './changes-card.js';
import { Compaction, TaskEnd, UserEntry } from './status-entries.js';
import { ToolView } from './tools/tool-view.js';

const DIFF_PREVIEW_LINES = 24;

const FULL_WIDTH_TOOLS = ['bash', 'edit', 'todo', 'ask', 'plan'];

export interface EntryViewProps {
  entry: Entry;
  live?: boolean;
}

/** Entries never change once they are done, so only the one streaming draws again. */
export const EntryView = memo(function EntryView({ entry, live = false }: EntryViewProps) {
  // A pending question lives in the ask panel at the bottom until it is answered.
  if (entry.kind === 'tool' && entry.run.name === 'ask' && entry.status === 'running') return null;

  const fullWidth =
    entry.kind === 'banner' ||
    entry.kind === 'user' ||
    entry.kind === 'changes' ||
    (entry.kind === 'tool' && FULL_WIDTH_TOOLS.includes(entry.run.name));

  const body = <EntryBody entry={entry} live={live} />;
  return (
    <Box flexDirection="column" marginTop={1} paddingX={fullWidth ? 0 : 1}>
      {expandable(entry) ? (
        <Expandable id={entry.id} fit={fitsText(entry)}>
          {body}
        </Expandable>
      ) : (
        body
      )}
    </Box>
  );
});

function expandable(entry: Entry) {
  switch (entry.kind) {
    case 'thinking':
      return true;
    case 'tool':
      switch (entry.run.name) {
        case 'bash':
          return entry.output.length > 0;
        case 'edit':
          return parsePatch(entry.run.result?.patch ?? entry.run.input.patch).length > DIFF_PREVIEW_LINES;
        case 'agent':
          return (entry.children?.length ?? 0) > 0;
        default:
          return false;
      }
    case 'user':
      return entry.prompt !== undefined;
    case 'compaction':
      return entry.summary !== undefined;
    default:
      return false;
  }
}

const fitsText = (entry: Entry) =>
  entry.kind === 'thinking' || entry.kind === 'compaction' || (entry.kind === 'tool' && entry.run.name === 'agent');

function EntryBody({ entry, live }: { entry: Entry; live: boolean }) {
  const { expanded } = useView();
  switch (entry.kind) {
    case 'banner':
      return <Banner />;
    case 'user':
      return <UserEntry text={expanded && entry.prompt ? entry.prompt : entry.text} steered={entry.steered} />;
    case 'thinking': {
      // Shown as it comes, then down to one line once the agent moved on, as in Claude Code.
      const folded = !expanded && (entry.endedAt !== undefined || !live);
      const took =
        entry.startedAt !== undefined && entry.endedAt !== undefined ? elapsed(Math.max(1000, entry.endedAt - entry.startedAt)) : undefined;
      return <Thinking text={entry.text} folded={folded} took={took} />;
    }
    case 'text':
      return <Markdown text={entry.text} />;
    case 'notice':
      return <Notice text={entry.text} tone={entry.tone} />;
    case 'task':
      return <TaskEnd entry={entry} />;
    case 'compaction':
      return <Compaction entry={entry} />;
    case 'changes':
      return <ChangesCard entry={entry} />;
    case 'tool':
      return <ToolView entry={entry} live={live} />;
  }
}
