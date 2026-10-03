import { useEffect, useMemo, useState } from 'react';
import { Box, fuzzyFilter, Highlight, ListRow, Panel, PromptInput, SelectList, Text, useInput, useListNavigation, usePanel, useTheme, useWindowSize } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import { useJinion } from '../app/context.js';
import { firstPrompt, type SavedSession } from '../conversation/session.js';
import { ago } from '../lib/format.js';
import { sessionAtom } from '../state/session.js';

const CHROME_ROWS = 9;
const ROWS_PER_SESSION = 2;

export function ResumePanel({ query: initialQuery = '' }: { query?: string }) {
  const theme = useTheme();
  const jinion = useJinion();
  const { close } = usePanel();
  const { rows } = useWindowSize();
  const { id: current } = useAtomValue(sessionAtom);

  const [query, setQuery] = useState(initialQuery.trim());

  const sessions = useMemo(() => jinion.sessions.list().filter((session) => session.id !== current), [current]);
  const matches = useMemo(() => fuzzyFilter(sessions, query, (session) => session.title), [sessions, query]);
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
    jinion.conversation.resume(match.item);
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

  return `${messages} messages · "${firstPrompt(session) ?? ''}"`;
}
