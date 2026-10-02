import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../runtime/context.js';
import { ChoiceList, useChoiceList } from '../primitives/choice-list.js';
import { Panel } from '../primitives/panel.js';
import { stepIndex } from '../primitives/select-list.js';
import { Tabs } from '../primitives/tabs.js';

export interface ModelOption {
  /** What the agent takes, e.g. `opus` or `gpt-5.5-codex`. */
  id: string;
  name: string;
  description?: string;
  /** Effort levels the model accepts, lowest first. Empty when it has none. */
  efforts: string[];
}

export interface ModelSelection {
  model: string;
  /** `undefined` leaves it to the model's default. */
  effort?: string;
}

export interface ModelPanelProps {
  /** `undefined` while the agent is still looking them up. */
  models: ModelOption[] | undefined;
  current: ModelSelection;
  /** Shown next to the title, e.g. the agent's name. */
  subtitle?: string;
  onSelect(selection: ModelSelection): void;
  onCancel(): void;
}

const DEFAULT = 'default';
const VISIBLE = 5;

/**
 * Picks a model and its effort, in the prompt's place:
 *
 *     +- Model Claude -----------------------------------+
 *     | effort  default  low  medium [high] xhigh  max   |
 *     +--------------------------------------------------+
 *     | > 1. Opus 5.5                           current  |
 *     |      For complex work and everyday tasks         |
 *     |   2. Sonnet 5.5                                  |
 *     +--------------------------------------------------+
 */
export function ModelPanel({ models, current, subtitle, onSelect, onCancel }: ModelPanelProps) {
  const theme = useTheme();
  const options = models ?? [];
  const [effort, setEffort] = useState(current.effort ?? DEFAULT);

  const list = useChoiceList({
    keys: options.map((option) => option.id),
    mode: 'single',
    // Focus is kept by id, so it lands on the model in use even when the models arrive after the panel opened.
    initialFocus: current.model,
    onCancel,
    onSubmit: ([id]) => id && onSelect({ model: id, effort: shown === DEFAULT ? undefined : shown }),
  });

  const model = options.find((option) => option.id === list.focus);
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
      {models === undefined ? (
        <Text color={theme.muted}>Loading models…</Text>
      ) : (
        <ChoiceList
          list={list}
          limit={VISIBLE}
          empty="No models available"
          choices={options.map((option) => ({
            key: option.id,
            label: option.name,
            description: option.description,
            aside: option.id === current.model ? 'current' : undefined,
          }))}
        />
      )}
    </Panel>
  );
}
