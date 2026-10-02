import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../runtime/context.js';
import { ChoiceList, choiceIndent, useChoiceList, type Choice } from '../primitives/choice-list.js';
import { Panel } from '../primitives/panel.js';
import { PromptInput } from './prompt-input.js';

export interface PlanOption {
  id: string;
  label: string;
  description?: string;
}

export type PlanPanelDecision = { approve: true; option: string } | { approve: false; note?: string };

export interface PlanPanelProps {
  /** Ways to carry on once the plan is approved; the first is focused. */
  options: PlanOption[];
  onDecide(decision: PlanPanelDecision): void;
  onCancel(): void;
}

const KEEP = 'keep';

/**
 * Asks whether to go ahead with the plan shown above it, in the prompt's place:
 *
 *     +- Plan -----------------------------------+
 *     | Ready to start? The plan is above.       |
 *     +------------------------------------------+
 *     | > 1. Yes, and use auto mode              |
 *     |   2. Yes, and accept edits               |
 *     |   3. No, keep planning                   |
 *     +------------------------------------------+
 */
export function PlanPanel({ options, onDecide, onCancel }: PlanPanelProps) {
  const theme = useTheme();
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<string>();

  const list = useChoiceList({
    keys: [...options.map((option) => option.id), KEEP],
    mode: 'single',
    isActive: editing === undefined,
    onCancel,
    onSubmit: ([key]) =>
      key === KEEP ? onDecide({ approve: false, note: note || undefined }) : onDecide({ approve: true, option: key! }),
  });

  useInput(
    (input) => {
      if (input !== 'n') return;
      list.setFocus(KEEP);
      setEditing(note);
    },
    { isActive: editing === undefined },
  );
  useInput(
    (_, key) => {
      if (key.escape) setEditing(undefined);
    },
    { isActive: editing !== undefined },
  );

  const editor = editing !== undefined && (
    <Box paddingLeft={choiceIndent(list)}>
      <Text color={theme.muted}>note: </Text>
      <PromptInput
        value={editing}
        onChange={setEditing}
        onSubmit={(value) => {
          setNote(value.trim());
          setEditing(undefined);
        }}
        placeholder="What should change in the plan?"
        paddingX={0}
      />
    </Box>
  );

  const choices: Choice[] = [
    ...options.map(({ id, label, description }) => ({ key: id, label, description })),
    {
      key: KEEP,
      label: 'No, keep planning',
      description: 'Press n to say what should change',
      note: note || undefined,
      editor: editor || undefined,
    },
  ];

  return (
    <Panel
      title="Plan"
      header={
        <>
          <Text bold>Ready to start? The plan is above.</Text>
          <Text> </Text>
        </>
      }
      hints={
        editing !== undefined
          ? [
              ['Enter', 'save'],
              ['Esc', 'back'],
            ]
          : [
              ['Enter', 'select'],
              ['n', 'note'],
              ['Up/Down', 'move'],
              ['Esc', 'stop the turn'],
            ]
      }
    >
      <ChoiceList list={list} choices={choices} limit={choices.length} />
    </Panel>
  );
}
