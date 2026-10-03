import { useState } from 'react';
import { Text } from 'ink';
import { ChoiceList, choiceIndent, useChoiceList, type Choice } from '../primitives/choice-list.js';
import { Panel } from '../primitives/panel.js';
import { EDITOR_HINTS, OptionEditor, useOptionEditor } from './option-editor.js';

export interface PlanOption {
  id: string;
  label: string;
  description?: string;
}

export type PlanPanelDecision = { approve: true; option: string } | { approve: false; note?: string };

export interface PlanPanelProps {
  options: PlanOption[];
  onDecide(decision: PlanPanelDecision): void;
  onCancel(): void;
}

const KEEP = 'keep';

export function PlanPanel({ options, onDecide, onCancel }: PlanPanelProps) {
  const [note, setNote] = useState('');
  const [editing, setEditing] = useOptionEditor(() => {
    list.setFocus(KEEP);
    return note;
  });

  const list = useChoiceList({
    keys: [...options.map((option) => option.id), KEEP],
    mode: 'single',
    isActive: editing === undefined,
    onCancel,
    onSubmit: ([key]) =>
      key === KEEP ? onDecide({ approve: false, note: note || undefined }) : onDecide({ approve: true, option: key! }),
  });

  const editor = editing !== undefined && (
    <OptionEditor
      indent={choiceIndent(list)}
      note
      value={editing}
      onChange={setEditing}
      onSubmit={(value) => {
        setNote(value.trim());
        setEditing(undefined);
      }}
      placeholder="What should change in the plan?"
    />
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
          ? EDITOR_HINTS
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
