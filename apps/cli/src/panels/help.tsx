import { useEffect } from 'react';
import { Box, ListRow, Panel, Prose, SelectList, Tabs, Text, useInput, useListNavigation, usePanel, useTabs, useTheme, type KeyHint } from '@jinion/tui';
import { useAtomValue } from 'jotai';
import type { AgentCommand } from '@jinion/core/agent/agent';
import { useJinion } from '../app/context.js';
import { SHORTCUTS } from '../app/shortcuts.js';
import { requiresArgument } from '@jinion/core/commands/registry';
import type { Jinion } from '@jinion/core/controllers/jinion';
import { skillGroup, sortSkills } from '@jinion/core/prompt/skills';
import { skillsAtom } from '@jinion/core/state/agent';

const SHORTCUT_COLUMNS = 3;

interface HelpItem {
  label: string;
  hint?: string;
  description: string;
  aside?: string;
  pick(jinion: Jinion): void;
}

export function HelpPanel({ topic = '' }: { topic?: string }) {
  const jinion = useJinion();
  const { close } = usePanel();
  const skills = sortSkills(useAtomValue(skillsAtom));

  const mention = (skill: AgentCommand): HelpItem => ({
    label: `$${skill.name}`,
    hint: skill.argumentHint,
    description: skill.description,
    aside: skillGroup(skill),
    pick: (app) => app.session.input.fill(`$${skill.name} `),
  });

  const groups = [
    {
      label: 'Commands',
      items: jinion.commands.list().map(
        (command): HelpItem => ({
          label: `/${command.name}`,
          hint: command.argumentHint,
          description: command.description,
          aside: command.aliases?.map((alias) => `/${alias}`).join(' '),
          pick: (app) => (requiresArgument(command) ? app.session.input.fill(`/${command.name} `) : command.run(app, '')),
        }),
      ),
    },
    { label: 'Skills', items: skills.filter((skill) => skill.source === 'skill').map(mention) },
    { label: 'MCP prompts', items: skills.filter((skill) => skill.source === 'mcp').map(mention) },
  ].filter((group) => group.items.length > 0);

  const tabs = ['General', ...groups.map((group) => group.label)];

  const [tab] = useTabs(tabs.length, {
    initial: Math.max(0, tabs.findIndex((label) => label.toLowerCase().startsWith(topic.trim().toLowerCase() || '\0'))),
  });

  const items = tab === 0 ? [] : groups[tab - 1]!.items;
  const [selected, setSelected] = useListNavigation(items.length, { isActive: tab > 0 });

  const hints: KeyHint[] =
    tab === 0
      ? [
          ['Left/Right', 'switch tab'],
          ['Esc', 'close'],
        ]
      : [
          ['Enter', groups[tab - 1]?.label === 'Commands' ? 'run' : 'insert'],
          ['Up/Down', 'move'],
          ['Left/Right', 'switch tab'],
          ['Esc', 'close'],
        ];

  useEffect(() => setSelected(0), [tab, setSelected]);

  useInput((_, key) => {
    if (key.escape) return close();

    const item = items[selected];
    if (!key.return || !item) return;

    close();
    item.pick(jinion);
  });

  return (
    <Panel title="Help" header={<Tabs tabs={tabs} active={tab} />} hints={hints}>
      {tab === 0 ? <General /> : <ItemList items={items} selected={selected} />}
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

function ItemList({ items, selected }: { items: HelpItem[]; selected: number }) {
  const theme = useTheme();

  const width = (item: HelpItem) => item.label.length + (item.hint ? item.hint.length + 1 : 0);
  const labelWidth = Math.min(32, Math.max(...items.map(width)));

  return (
    <SelectList
      items={items}
      selected={selected}
      limit={10}
      renderItem={(item, state) => (
        <ListRow
          selected={state.selected}
          labelWidth={labelWidth}
          label={
            <Text>
              {item.label}
              {item.hint && <Text color={theme.muted}> {item.hint}</Text>}
            </Text>
          }
          description={item.description}
          aside={item.aside}
        />
      )}
    />
  );
}
