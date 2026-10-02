import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../runtime/context.js';
import { ChoiceList, choiceIndent, useChoiceList, type Choice } from '../primitives/choice-list.js';
import { Panel } from '../primitives/panel.js';
import { Prose } from '../primitives/prose.js';
import { ShellCommand } from '../content/shell.js';
import { PromptInput } from './prompt-input.js';

export interface PermissionRequest {
  /** What the agent wants to do, e.g. `jinion wants to run a command`. */
  title: string;
  /** Shown highlighted as `$ command`. */
  command?: string;
  /** A path, URL or other target, when there is no command. */
  subject?: string;
  /** Why it is needed, or why this needs asking. */
  description?: string;
  /** What "don't ask again" would allow, e.g. `pnpm add:*`. Without it that choice is not offered. */
  always?: string;
  /** Focuses "No" first, so a stray Enter can't approve. */
  defaultToNo?: boolean;
}

export type PermissionDecision = { allow: true; always?: boolean } | { allow: false; note?: string };

export interface PermissionPanelProps {
  request: PermissionRequest;
  onDecide(decision: PermissionDecision): void;
  onCancel(): void;
}

/**
 * Asks before the agent runs something, in the prompt's place:
 *
 *     +- Permission ---------------------+
 *     | jinion wants to run a command    |
 *     |   $ pnpm add zod                 |
 *     +----------------------------------+
 *     | > 1. Yes                         |
 *     |   2. Yes, and don't ask again    |
 *     |   3. No                          |
 *     +----------------------------------+
 */
export function PermissionPanel({ request, onDecide, onCancel }: PermissionPanelProps) {
  const theme = useTheme();
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<string>();

  const decisions = [
    { key: 'once', label: 'Yes' },
    ...(request.always ? [{ key: 'always', label: `Yes, and don't ask again for ${request.always} in this project` }] : []),
    { key: 'deny', label: 'No', description: 'Press n to tell jinion what to do instead' },
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

  useInput(
    (input) => {
      if (input !== 'n') return;
      list.setFocus('deny');
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
        placeholder="What should jinion do instead?"
        paddingX={0}
      />
    </Box>
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
