import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../runtime/theme.js';
import { ChoiceList, useChoiceList } from '../primitives/choice-list.js';
import { Panel } from '../primitives/panel.js';
import { stepIndex } from '../primitives/list-navigation.js';
import { Tabs } from '../primitives/tabs.js';

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
  efforts: string[];
}

export interface ModelSelection {
  model: string;
  effort?: string;
}

/** Models from one source, such as a provider; `models` is missing while they are still listed. */
export interface ModelGroup {
  name: string;
  models?: ModelOption[];
}

export interface ModelPanelProps {
  /** With more than one, each shows under its name. */
  groups: ModelGroup[];
  current: ModelSelection & { group: string };
  subtitle?: string;
  onSelect(selection: ModelSelection, group: string): void;
  onCancel(): void;
}

const DEFAULT = 'default';
const VISIBLE = 8;

export function ModelPanel({ groups, current, subtitle, onSelect, onCancel }: ModelPanelProps) {
  const theme = useTheme();

  const [effort, setEffort] = useState(current.effort ?? DEFAULT);

  const grouped = groups.length > 1;
  const options = groups.flatMap(({ name, models = [] }) => models.map((model) => ({ key: `${name}:${model.id}`, group: name, model })));
  const listing = groups.filter((group) => group.models === undefined).map((group) => group.name);

  const list = useChoiceList({
    keys: options.map((option) => option.key),
    mode: 'single',
    // Focus is kept by key, so it lands on the model in use even when the models arrive after the panel opened.
    initialFocus: `${current.group}:${current.model}`,
    onCancel,
    onSubmit: ([key]) => {
      const chosen = options.find((option) => option.key === key);

      if (chosen) onSelect({ model: chosen.model.id, effort: shown === DEFAULT ? undefined : shown }, chosen.group);
    },
  });

  const model = options.find((option) => option.key === list.focus)?.model;
  const levels = model && model.efforts.length > 0 ? [DEFAULT, ...model.efforts] : [];
  // A level the focused model doesn't have shows as its default, but stays picked for models that do.
  const shown = levels.includes(effort) ? effort : DEFAULT;

  useInput((_, key) => {
    if ((key.leftArrow || key.rightArrow) && levels.length > 0) {
      setEffort(levels[stepIndex(levels.indexOf(shown), key.rightArrow ? 1 : -1, levels.length, false)]!);
    }
  });

  return (
    <Panel
      title="Model"
      subtitle={subtitle}
      header={
        <Box>
          <Text color={theme.muted}>effort </Text>
          {levels.length > 0 ? (
            <Tabs tabs={levels} active={levels.indexOf(shown)} />
          ) : (
            <Text color={theme.muted}>{model ? `${model.name} has no effort setting` : '-'}</Text>
          )}
        </Box>
      }
      hints={[
        ['Enter', 'select'],
        ['Up/Down', 'model'],
        ['Left/Right', 'effort'],
        ['Esc', 'cancel'],
      ]}
    >
      {listing.length === groups.length ? (
        <Text color={theme.muted}>Loading models…</Text>
      ) : (
        <ChoiceList
          list={list}
          limit={VISIBLE}
          empty="No models available"
          choices={options.map((option) => ({
            key: option.key,
            group: grouped ? option.group : undefined,
            label: option.model.name,
            description: option.model.description,
            aside: option.group === current.group && option.model.id === current.model ? 'current' : undefined,
          }))}
        />
      )}
      {listing.length > 0 && listing.length < groups.length && (
        <Box marginTop={1}>
          <Text color={theme.muted}>Listing the models of {listing.join(' and ')}…</Text>
        </Box>
      )}
    </Panel>
  );
}
