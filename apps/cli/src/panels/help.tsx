import { useEffect } from 'react';
import {
  Box,
  ListRow,
  Panel,
  Prose,
  SelectList,
  Tabs,
  Text,
  useInput,
  useListNavigation,
  usePanel,
  useTabs,
  useTheme,
  type KeyHint,
} from '@jinion/tui';
import type { Command } from '../commands/registry.js';
import { useJinion } from '../context.js';
import { SHORTCUTS } from '../shortcuts.js';

const SHORTCUT_COLUMNS = 3;

/** `/help`: a General tab with shortcuts, then one tab per command source. */
export function HelpPanel({ topic = '' }: { topic?: string }) {
  const app = useJinion();
  const { close } = usePanel();
  const groups = app.commands.groups();
  const tabs = ['General', ...groups.map((group) => group.label)];
  const [tab] = useTabs(tabs.length, {
    initial: Math.max(0, tabs.findIndex((label) => label.toLowerCase() === topic.trim().toLowerCase())),
  });
  const commands = tab === 0 ? [] : groups[tab - 1]!.commands;
  const [selected, setSelected] = useListNavigation(commands.length, { isActive: tab > 0 });

  useEffect(() => setSelected(0), [tab, setSelected]);

  useInput((_, key) => {
    if (key.escape) return close();
    const command = commands[selected];
    if (!key.return || !command) return;
    close();
    if (command.argumentHint?.startsWith('<')) app.actions.fill(`/${command.name} `);
    else command.run(app, '');
  });

  const hints: KeyHint[] =
    tab === 0
      ? [
          ['Left/Right', 'switch tab'],
          ['Esc', 'close'],
        ]
      : [
          ['Enter', 'run'],
          ['Up/Down', 'move'],
          ['Left/Right', 'switch tab'],
          ['Esc', 'close'],
        ];

  return (
    <Panel title="Help" header={<Tabs tabs={tabs} active={tab} />} hints={hints}>
      {tab === 0 ? <General /> : <CommandList commands={commands} selected={selected} />}
    </Panel>
  );
}

function General() {
  const theme = useTheme();
  const perColumn = Math.ceil(SHORTCUTS.length / SHORTCUT_COLUMNS);
  const columns = Array.from({ length: SHORTCUT_COLUMNS }, (_, index) =>
    SHORTCUTS.slice(index * perColumn, (index + 1) * perColumn),
  );

  return (
    <Box flexDirection="column">
      <Prose>Jinion reads your codebase, edits files and runs commands, right from your terminal.</Prose>
      <Text> </Text>
      <Text bold>Shortcuts</Text>
      <Box>
        {columns.map((column, index) => (
          <Box key={index} flexDirection="column" flexGrow={1} flexBasis={0}>
            {column.map(([keys, action]) => (
              <Text key={keys} wrap="truncate-end">
                <Text color={theme.selection}>{keys}</Text>
                <Text color={theme.muted}> {action}</Text>
              </Text>
            ))}
          </Box>
        ))}
      </Box>
      <Text> </Text>
      <Text color={theme.muted}>
        Docs and updates: <Text color={theme.link}>https://jinion.co</Text>
      </Text>
    </Box>
  );
}

function CommandList({ commands, selected }: { commands: Command[]; selected: number }) {
  const theme = useTheme();
  const label = (command: Command) => `/${command.name}${command.argumentHint ? ` ${command.argumentHint}` : ''}`;
  const labelWidth = Math.min(32, Math.max(...commands.map((command) => label(command).length)));

  return (
    <SelectList
      items={commands}
      selected={selected}
      limit={10}
      renderItem={(command, state) => (
        <ListRow
          selected={state.selected}
          labelWidth={labelWidth}
          label={
            <Text>
              /{command.name}
              {command.argumentHint && <Text color={theme.muted}> {command.argumentHint}</Text>}
            </Text>
          }
          description={command.description}
          aside={command.aliases?.map((alias) => `/${alias}`).join(' ')}
        />
      )}
    />
  );
}
