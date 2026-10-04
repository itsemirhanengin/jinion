import { useState } from 'react';
import { Box, ChoiceList, choiceIndent, Panel, Prose, Text, useChoiceList, useInput, usePanel, useTheme, type Choice } from '@jinion/tui';
import { useJinion } from '../app/context.js';
import { plural } from '@jinion/core/lib/format';
import { tildify } from '@jinion/core/lib/paths';

const PREVIEW_LINES = 12;

export function MemoryPanel() {
  const jinion = useJinion();
  const theme = useTheme();
  const { close } = usePanel();

  const [notes, setNotes] = useState(() => jinion.memory.list());
  const [open, setOpen] = useState<string>();
  const [forgetting, setForgetting] = useState<string>();

  const keys = notes.map((memory) => `${memory.scope}/${memory.id}`);

  const list = useChoiceList({
    keys,
    mode: 'single',
    onCancel: close,
    onSubmit: ([key]) => setOpen(open === key ? undefined : key),
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
            <Text color={theme.muted}>{tildify(jinion.memory.path(memory))}</Text>
          </Box>
        ) : undefined,
    };
  });

  useInput((input) => {
    if (input !== 'd' || !list.focus) return setForgetting(undefined);
    if (forgetting !== list.focus) return setForgetting(list.focus);

    const memory = jinion.memory.remove(list.focus);

    setForgetting(undefined);
    setNotes(jinion.memory.list());
    if (memory) jinion.notice(`Forgot ${memory.scope}/${memory.id}: ${memory.title}`);
  });

  return (
    <Panel
      title="Memory"
      subtitle={plural(notes.length, 'note')}
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
