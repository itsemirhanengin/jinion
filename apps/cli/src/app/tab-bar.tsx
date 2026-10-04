import { Box, Clickable, Fill, Spinner, Text, useContentWidth, useTheme } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import { clip } from '@jinion/core/lib/text';
import { type Tab, tabsAtom } from '../state/session.js';
import { useApi } from './api.js';

const LONGEST_TITLE = 28;
const SHORTEST_TITLE = 8;
/** The corners, `+-` and `-+`, and a little rule left over at the end. */
const CHROME = 8;
/** Around a title: its number, the brackets or spaces, the mark, and the `--` before the next tab. */
const PER_TAB = 10;

/**
 * The tabs in a rule, as frames carry their titles: `+-[ 1 Shown ]-- 2 Other -- 3 Waiting ? ----+`. Shown once there
 * are two tabs, so a single conversation keeps its room; titles shorten so the rule stays on one line.
 */
export function TabBar() {
  const theme = useTheme();
  const tabs = useAtomValue(tabsAtom);
  const width = useContentWidth();

  if (tabs.length < 2) return null;

  const room = Math.floor((width - CHROME) / tabs.length) - PER_TAB;
  const titleLength = Math.max(SHORTEST_TITLE, Math.min(LONGEST_TITLE, room));

  return (
    <Box width="100%">
      <Text color={theme.border}>+-</Text>
      {tabs.map((tab, index) => (
        <Box key={tab.id}>
          {index > 0 && <Text color={theme.border}>--</Text>}
          <TabLabel tab={tab} number={index + 1} titleLength={titleLength} />
        </Box>
      ))}
      <Text color={theme.border}>-</Text>
      <Fill color={theme.border} />
      <Text color={theme.border}>+</Text>
    </Box>
  );
}

function TabLabel({ tab, number, titleLength }: { tab: Tab; number: number; titleLength: number }) {
  const api = useApi();
  const theme = useTheme();

  const title = clip(tab.title ?? 'New conversation', titleLength);

  return (
    <Clickable id={`tab:${tab.id}`} fit onClick={() => api.act(api.request('sessions/activate', { session: tab.id }))}>
      <Text>
        <Text color={theme.border}>{tab.shown ? '[ ' : ' '}</Text>
        <Text color={tab.shown ? theme.accent : theme.muted}>{number} </Text>
        <Text bold={tab.shown} color={tab.shown ? theme.accent : theme.muted}>
          {title}
        </Text>
        <Mark tab={tab} />
        <Text color={theme.border}>{tab.shown ? ' ]' : ' '}</Text>
      </Text>
    </Clickable>
  );
}

function Mark({ tab }: { tab: Tab }) {
  const theme = useTheme();

  if (tab.waiting) return <Text color={theme.warning}> ?</Text>;
  if (!tab.working) return null;

  return (
    <Text>
      {' '}
      <Spinner color={theme.accent} />
    </Text>
  );
}
