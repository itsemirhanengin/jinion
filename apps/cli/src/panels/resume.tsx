import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  fuzzyFilter,
  Highlight,
  ListRow,
  Panel,
  PromptInput,
  SelectList,
  Text,
  useInput,
  useListNavigation,
  usePanel,
  useTheme,
  useWindowSize,
} from '@jinion/tui';
import { useJinion } from '../context.js';
import { firstPrompt, type SavedSession } from '../session.js';

/** Rows the panel itself takes: edges, search, dividers, hints and the `… more` markers. */
const CHROME_ROWS = 9;
const ROWS_PER_SESSION = 2;

/** `/resume`: every saved conversation, searchable, full screen. */
export function ResumePanel({ query: initialQuery = '' }: { query?: string }) {
  const theme = useTheme();
  const app = useJinion();
  const { close } = usePanel();
  const { rows } = useWindowSize();
  const [query, setQuery] = useState(initialQuery.trim());

  const sessions = useMemo(
    () => app.sessions.list().filter((session) => session.id !== app.sessionId),
    [app.sessions, app.sessionId],
  );
  const matches = useMemo(
    () => fuzzyFilter(sessions, query, (session) => session.title),
    [sessions, query],
  );
  const limit = Math.max(1, Math.floor((rows - CHROME_ROWS) / ROWS_PER_SESSION));
  const [selected, setSelected] = useListNavigation(matches.length, { wrap: false, pageSize: limit });

  useEffect(() => setSelected(0), [query, setSelected]);
  useInput((_, key) => {
    if (key.escape) close();
  });

  const choose = () => {
    const match = matches[selected];
    if (!match) return;
    close();
    app.actions.resume(match.item);
  };

  return (
    <Panel
      title="Resume"
      subtitle={`${sessions.length} conversations`}
      grow
      header={
        <Box>
          <Text color={theme.muted}>search </Text>
          <PromptInput value={query} onChange={setQuery} onSubmit={choose} placeholder="Type to filter" paddingX={0} />
        </Box>
      }
      hints={[
        ['Enter', 'resume'],
        ['Up/Down', 'move'],
        ['PgUp/PgDn', 'page'],
        ['Esc', 'close'],
      ]}
    >
      <SelectList
        items={matches}
        selected={selected}
        limit={limit}
        empty={sessions.length === 0 ? 'No saved conversations yet' : 'No conversations match'}
        renderItem={({ item, positions }, state) => (
          <ListRow
            selected={state.selected}
            label={<Highlight text={item.title} positions={positions} />}
            aside={ago(item.updatedAt)}
            detail={describe(item)}
          />
        )}
      />
    </Panel>
  );
}

function describe(session: SavedSession) {
  const messages = session.entries.filter((entry) => entry.kind === 'user' || entry.kind === 'text').length;
  const prompt = firstPrompt(session) ?? '';
  return `${messages} messages · "${prompt}"`;
}

function ago(timestamp: number) {
  const minutes = Math.round((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.round(days / 7)}w ago`;
}
