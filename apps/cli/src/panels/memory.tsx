import { useState } from 'react';
import { Box, ChoiceList, choiceIndent, Panel, Prose, Text, useChoiceList, useInput, usePanel, useTheme, type Choice } from '@jinion/tui';
import { useJinion } from '../context.js';
import { tildify } from '../paths.js';

/** Lines of a note's content shown when it is opened. */
const PREVIEW_LINES = 12;

/** `/memory`: the notes the agent keeps. Enter opens one, `d` twice forgets it. */
export function MemoryPanel() {
  const app = useJinion();
  const theme = useTheme();
  const { close } = usePanel();
  const [notes, setNotes] = useState(() => app.memory.list());
  const [open, setOpen] = useState<string>();
  const [forgetting, setForgetting] = useState<string>();
  const keys = notes.map((memory) => `${memory.scope}/${memory.id}`);

  const list = useChoiceList({
    keys,
    mode: 'single',
    onCancel: close,
    onSubmit: ([key]) => setOpen(open === key ? undefined : key),
  });

  useInput((input) => {
    if (input !== 'd' || !list.focus) return setForgetting(undefined);
    if (forgetting !== list.focus) return setForgetting(list.focus);
    const memory = app.memory.remove(list.focus);
    setForgetting(undefined);
    setNotes(app.memory.list());
    if (memory) app.actions.notice(`Forgot ${memory.scope}/${memory.id}: ${memory.title}`);
  });

  const choices: Choice[] = notes.map((memory) => {
    const key = `${memory.scope}/${memory.id}`;
    const lines = memory.content.split('\n');
    return {
      key,
      label: memory.title,
      description: `${memory.scope} · ${memory.type} · ${memory.description}`,
      aside: forgetting === key ? <Text color={theme.error}>press d again to forget</Text> : memory.updated,
      editor:
        open === key ? (
          <Box flexDirection="column" paddingLeft={choiceIndent(list)} marginBottom={1}>
            <Prose>{lines.slice(0, PREVIEW_LINES).join('\n')}</Prose>
            {lines.length > PREVIEW_LINES && <Text color={theme.muted}>… {lines.length - PREVIEW_LINES} more lines</Text>}
            <Text color={theme.muted}>{tildify(app.memory.path(memory))}</Text>
          </Box>
        ) : undefined,
    };
  });

  return (
    <Panel
      title="Memory"
      subtitle={`${notes.length} notes`}
      hints={[
        ['Enter', 'open'],
        ['d', 'forget'],
        ['Up/Down', 'move'],
        ['Esc', 'close'],
      ]}
    >
      <ChoiceList
        list={list}
        choices={choices}
        limit={6}
        empty="No notes yet. The agent saves them as it learns, /remember adds one, and /memory import brings in Claude Code's."
      />
    </Panel>
  );
}
