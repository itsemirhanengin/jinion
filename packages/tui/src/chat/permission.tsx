import { useState } from 'react';
import { Box, Text } from 'ink';
import { useTheme } from '../runtime/theme.js';
import { ChoiceList, choiceIndent, useChoiceList, type Choice } from '../primitives/choice-list.js';
import { Panel } from '../primitives/panel.js';
import { Prose } from '../primitives/prose.js';
import { ShellCommand } from '../content/shell.js';
import { EDITOR_HINTS, OptionEditor, useOptionEditor } from './option-editor.js';

export interface PermissionRequest {
  title: string;
  command?: string;
  subject?: string;
  description?: string;
  always?: string;
  defaultToNo?: boolean;
}

export type PermissionDecision = { allow: true; always?: boolean } | { allow: false; note?: string };

export interface PermissionPanelProps {
  request: PermissionRequest;
  agent: string;
  onDecide(decision: PermissionDecision): void;
  onCancel(): void;
}

export function PermissionPanel({ request, agent, onDecide, onCancel }: PermissionPanelProps) {
  const theme = useTheme();
  const [note, setNote] = useState('');
  const [editing, setEditing] = useOptionEditor(() => {
    list.setFocus('deny');
    return note;
  });

  const decisions = [
    { key: 'once', label: 'Yes' },
    ...(request.always ? [{ key: 'always', label: `Yes, and don't ask again for ${request.always} in this project` }] : []),
    { key: 'deny', label: 'No', description: `Press n to tell ${agent} what to do instead` },
  ];

  const list = useChoiceList({
    keys: decisions.map((decision) => decision.key),
    mode: 'single',
    initialFocus: request.defaultToNo ? 'deny' : 'once',
    isActive: editing === undefined,
    onCancel,
    onSubmit: ([key]) =>
      key === 'deny' ? onDecide({ allow: false, note: note || undefined }) : onDecide({ allow: true, always: key === 'always' }),
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
      placeholder={`What should ${agent} do instead?`}
    />
  );

  const choices: Choice[] = decisions.map((decision) =>
    decision.key === 'deny' ? { ...decision, note: note || undefined, editor: editor || undefined } : decision,
  );

  return (
    <Panel
      title="Permission"
      header={
        <>
          <Prose bold>{request.title}</Prose>
          {request.command && (
            <Box paddingLeft={2}>
              <ShellCommand command={request.command} />
            </Box>
          )}
          {request.subject && (
            <Box paddingLeft={2}>
              <Prose color={theme.code}>{request.subject}</Prose>
            </Box>
          )}
          {request.description && (
            <Box paddingLeft={2}>
              <Prose color={theme.muted}>{request.description}</Prose>
            </Box>
          )}
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
