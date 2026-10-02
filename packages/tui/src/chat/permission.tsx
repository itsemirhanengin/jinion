import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../runtime/context.js';
import { OptionRow, optionIndent } from '../primitives/option-row.js';
import { Panel } from '../primitives/panel.js';
import { Prose } from '../primitives/prose.js';
import { ShellCommand } from '../content/shell.js';
import type { QuestionOption } from './ask.js';
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
  const options: (QuestionOption & { decision: 'once' | 'always' | 'deny' })[] = [
    { label: 'Yes', decision: 'once' },
    ...(request.always
      ? [{ label: `Yes, and don't ask again for ${request.always} in this project`, decision: 'always' as const }]
      : []),
    { label: 'No', description: 'Press n to tell jinion what to do instead', decision: 'deny' },
  ];
  const deny = options.length - 1;
  const [focus, setFocus] = useState(request.defaultToNo ? deny : 0);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState<string>();

  const decide = (index: number) => {
    const option = options[index]!;
    if (option.decision === 'deny') return onDecide({ allow: false, note: note || undefined });
    onDecide({ allow: true, always: option.decision === 'always' });
  };

  useInput((input, key) => {
    if (editing !== undefined) {
      if (key.escape) setEditing(undefined);
      return;
    }
    if (key.escape) return onCancel();
    if (key.upArrow) setFocus((value) => (value - 1 + options.length) % options.length);
    else if (key.downArrow || key.tab) setFocus((value) => (value + 1) % options.length);
    else if (/^[1-9]$/.test(input) && Number(input) <= options.length) setFocus(Number(input) - 1);
    else if (input === 'n') {
      setFocus(deny);
      setEditing(note);
    } else if (key.return) decide(focus);
  });

  const editor = editing !== undefined && (
    <Box paddingLeft={optionIndent(options.length)}>
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
      {options.map((option, index) => (
        <OptionRow
          key={option.decision}
          number={index + 1}
          count={options.length}
          label={option.label}
          description={option.description}
          focused={index === focus}
          note={option.decision === 'deny' ? note || undefined : undefined}
        >
          {index === deny ? editor || undefined : undefined}
        </OptionRow>
      ))}
    </Panel>
  );
}
