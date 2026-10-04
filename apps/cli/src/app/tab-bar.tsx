import { Box, Clickable, Spinner, Text, useTheme } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import { clip } from '@jinion/core/lib/text';
import { type Tab, tabsAtom } from '../state/session.js';
import { useApi } from './api.js';

const TITLE_LENGTH = 28;

/** Shown once there are two tabs, so a single conversation keeps its room. */
export function TabBar() {
  const tabs = useAtomValue(tabsAtom);

  if (tabs.length < 2) return null;

  return (
    <Box paddingX={1} flexWrap="wrap">
      {tabs.map((tab, index) => (
        <TabLabel key={tab.id} tab={tab} index={index} />
      ))}
    </Box>
  );
}

function TabLabel({ tab, index }: { tab: Tab; index: number }) {
  const api = useApi();
  const theme = useTheme();

  const title = clip(tab.title ?? 'New conversation', TITLE_LENGTH);

  return (
    <Clickable id={`tab:${tab.id}`} fit onClick={() => api.act(api.request('sessions/activate', { session: tab.id }))}>
      <Text>
        <Text color={theme.border}>{index === 0 ? '' : ' | '}</Text>
        <Text color={theme.muted}>{index + 1} </Text>
        <Text bold={tab.shown} color={tab.shown ? theme.accent : undefined}>
          {title}
        </Text>
        {tab.waiting ? (
          <Text color={theme.warning}> ?</Text>
        ) : (
          tab.working && (
            <Text>
              {' '}
              <Spinner color={theme.accent} />
            </Text>
          )
        )}
      </Text>
    </Clickable>
  );
}
