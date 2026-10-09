import { Box, Clickable, Spinner, Text, useContentWidth, useTheme } from '@jinion/tui';
import { atom, useAtomValue } from 'jotai';
import { clip } from '@jinion/core/lib/text';
import { type Tab, tabsAtom } from '../state/session.js';
import { useApi } from './api.js';

/** Whether the open conversations show beside the one shown; ctrl+s turns it on and off. */
export const sidebarOpenAtom = atom(true);

const WIDE_WIDTH = 24;
/** A row's number, a space, its mark and a space, then the line. */
const FOLDED_WIDTH = 7;
/** The line and the space between it and the conversation. */
const LINE = 2;
/** Around a title: its number and the space after it, the space before its mark, the mark and a space. */
const AROUND_TITLE = 6;
/** Narrower terminals keep only each row's number and mark, so the conversation keeps its room. */
const FOLD_BELOW = 100;

const RIGHT_PIPE = { left: '', right: '|', top: '', topLeft: '', topRight: '', bottom: '', bottomLeft: '', bottomRight: '' };

/** The open conversations, one per row, once there are two; `undefined` while there is one or it is turned off. */
export function useSidebar() {
  const tabs = useAtomValue(tabsAtom);
  const open = useAtomValue(sidebarOpenAtom);
  const columns = useContentWidth();

  if (!open || tabs.length < 2) return undefined;

  const folded = columns < FOLD_BELOW;

  return {
    width: folded ? FOLDED_WIDTH : WIDE_WIDTH,
    content: <Sidebar tabs={tabs} titleLength={folded ? 0 : WIDE_WIDTH - LINE - AROUND_TITLE} />,
  };
}

function Sidebar({ tabs, titleLength }: { tabs: Tab[]; titleLength: number }) {
  const theme = useTheme();

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      marginRight={1}
      borderStyle={RIGHT_PIPE}
      borderTop={false}
      borderBottom={false}
      borderLeft={false}
      borderColor={theme.border}
    >
      {tabs.map((tab, index) => (
        <Row key={tab.id} tab={tab} number={index + 1} titleLength={titleLength} />
      ))}
    </Box>
  );
}

function Row({ tab, number, titleLength }: { tab: Tab; number: number; titleLength: number }) {
  const api = useApi();
  const theme = useTheme();

  const color = tab.shown ? theme.accent : theme.muted;

  return (
    <Clickable id={`session:${tab.id}`} onClick={() => api.act(api.request('sessions/activate', { session: tab.id }))}>
      <Box>
        <Text color={color}>{`${String(number).padStart(2)} `}</Text>
        {titleLength > 0 && (
          <Box flexGrow={1} marginRight={1}>
            <Text bold={tab.shown} color={tab.shown ? theme.accent : undefined}>
              {clip(tab.title ?? 'New conversation', titleLength)}
            </Text>
          </Box>
        )}
        <Mark tab={tab} />
        <Text> </Text>
      </Box>
    </Clickable>
  );
}

function Mark({ tab }: { tab: Tab }) {
  const theme = useTheme();

  if (tab.waiting) return <Text color={theme.warning}>?</Text>;
  if (tab.working) return <Spinner color={theme.accent} />;

  return <Text> </Text>;
}
