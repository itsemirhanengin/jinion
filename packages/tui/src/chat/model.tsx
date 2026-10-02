import { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../runtime/context.js';
import { Panel } from '../primitives/panel.js';
import { SelectList, stepIndex, useListNavigation } from '../primitives/select-list.js';
import { Tabs } from '../primitives/tabs.js';
import { OptionRow } from '../primitives/option-row.js';

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
  const list = models ?? [];
  const [focus, setFocus] = useListNavigation(list.length, { wrap: false });
  const [effort, setEffort] = useState(current.effort ?? DEFAULT);

  // Models can arrive after the panel opened; start on the one in use.
  useEffect(() => {
    if (models) setFocus(Math.max(0, models.findIndex((option) => option.id === current.model)));
  }, [models]);

  const model = list[focus];
  const levels = model && model.efforts.length > 0 ? [DEFAULT, ...model.efforts] : [];
  // A level the focused model doesn't have shows as its default, but stays picked for models that do.
  const shown = levels.includes(effort) ? effort : DEFAULT;

  useInput((input, key) => {
    if (key.escape) return onCancel();
    if (!model) return;
    if (/^[1-9]$/.test(input) && Number(input) <= list.length) setFocus(Number(input) - 1);
    else if ((key.leftArrow || key.rightArrow) && levels.length > 0) {
      setEffort(levels[stepIndex(levels.indexOf(shown), key.rightArrow ? 1 : -1, levels.length, false)]!);
    } else if (key.return) {
      onSelect({ model: model.id, effort: shown === DEFAULT ? undefined : shown });
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
        <SelectList
          items={list}
          selected={focus}
          limit={VISIBLE}
          empty="No models available"
          renderItem={(item, state) => (
            <OptionRow
              number={state.index + 1}
              count={list.length}
              label={item.name}
              description={item.description}
              focused={state.selected}
              current={item.id === current.model}
            />
          )}
        />
      )}
    </Panel>
  );
}
