import { useEffect, useMemo, useState } from 'react';
import { Box, fuzzyFilter, Highlight, ListRow, Panel, PromptInput, SelectList, Text, useInput, useListNavigation, usePanel, useTheme, useWindowSize } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import type { SavedSummary } from '@jinion/core/api/protocol';
import { ago } from '@jinion/core/lib/format';
import { useApi } from '../app/api.js';
import { sessionAtom } from '../state/session.js';
import { useAsync } from '../ui/use-async.js';

const CHROME_ROWS = 9;
const ROWS_PER_SESSION = 2;

export function ResumePanel({ query: initialQuery = '' }: { query?: string }) {
  const theme = useTheme();
  const api = useApi();
  const { close } = usePanel();
  const { rows } = useWindowSize();
  const { id: current } = useAtomValue(sessionAtom);

  const [query, setQuery] = useState(initialQuery.trim());

  const saved = useAsync(() => api.request('saved/list', {}), [current]);
  const sessions = useMemo(() => (saved.state === 'done' ? saved.value.filter((session) => session.id !== current) : []), [saved, current]);
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
    api.act(api.inSession('sessions/replace', { resume: match.item.id }));
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
        empty={
          saved.state === 'pending'
            ? 'Reading saved conversations…'
            : saved.state === 'failed'
              ? `Couldn't read saved conversations: ${saved.error}`
              : sessions.length === 0
                ? 'No saved conversations yet'
                : 'No conversations match'
        }
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

function describe({ worktree, messages, firstPrompt = '' }: SavedSummary) {
  return `${worktree ? `worktree ${worktree} · ` : ''}${messages} messages · "${firstPrompt}"`;
}
