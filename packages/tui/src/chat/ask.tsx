import { useState, type ReactNode } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../runtime/context.js';
import { Frame, FrameDivider } from '../primitives/frame.js';
import { Panel } from '../primitives/panel.js';
import { Prose } from '../primitives/prose.js';
import { PromptInput } from './prompt-input.js';

export interface QuestionOption {
  label: string;
  description?: string;
  recommended?: boolean;
}

export interface Question {
  id: string;
  prompt: string;
  options: QuestionOption[];
}

export interface QuestionAnswer {
  /** Index of the chosen option; absent when the user typed their own answer. */
  option?: number;
  /** The user's own answer, given through "Other". */
  text?: string;
  note?: string;
}

const OTHER: QuestionOption = { label: 'Other (type your own)' };
/** Width of the `> ( ) ` marker, so descriptions and notes line up under the label. */
export const INDENT = 6;

interface Editing {
  kind: 'note' | 'other';
  value: string;
}

export interface AskPanelProps {
  questions: Question[];
  onSubmit(answers: QuestionAnswer[]): void;
  onCancel(): void;
}

/**
 * Interactive questions, one at a time, meant to take the prompt's place:
 *
 *     +- Ask ---------------------------+
 *     | Which project?                  |
 *     +---------------------------------+
 *     | > ( ) api (Recommended)         |
 *     |       NestJS backend            |
 *     |   ( ) Other (type your own)     |
 *     +---------------------------------+
 *     | Enter select · n note · ...     |
 *     +---------------------------------+
 */
export function AskPanel({ questions, onSubmit, onCancel }: AskPanelProps) {
  const theme = useTheme();
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [focus, setFocus] = useState(0);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [editing, setEditing] = useState<Editing>();

  const question = questions[answers.length];
  const options = question ? [...question.options, OTHER] : [];
  const other = options.length - 1;

  const answer = (value: QuestionAnswer) => {
    const next = [...answers, value];
    if (next.length === questions.length) return onSubmit(next);
    setAnswers(next);
    setFocus(0);
    setNotes({});
    setEditing(undefined);
  };

  const saveEdit = (value: string) => {
    const text = value.trim();
    if (editing?.kind === 'other') {
      if (text) return answer({ text });
      return setEditing(undefined);
    }
    setNotes((current) => {
      const { [focus]: _, ...rest } = current;
      return text ? { ...rest, [focus]: text } : rest;
    });
    setEditing(undefined);
  };

  useInput((input, key) => {
    if (editing) {
      if (key.escape) setEditing(undefined);
      return;
    }
    if (key.escape) return onCancel();
    if (key.upArrow) setFocus((value) => (value - 1 + options.length) % options.length);
    else if (key.downArrow || key.tab) setFocus((value) => (value + 1) % options.length);
    else if (/^[1-9]$/.test(input) && Number(input) <= options.length) setFocus(Number(input) - 1);
    else if (input === 'n' && focus !== other) setEditing({ kind: 'note', value: notes[focus] ?? '' });
    else if (key.return) {
      if (focus === other) setEditing({ kind: 'other', value: '' });
      else answer({ option: focus, note: notes[focus] });
    }
  });

  if (!question) return null;

  const editor = editing && (
    <Box paddingLeft={INDENT}>
      {editing.kind === 'note' && <Text color={theme.muted}>note: </Text>}
      <PromptInput
        value={editing.value}
        onChange={(value) => setEditing({ ...editing, value })}
        onSubmit={saveEdit}
        placeholder={editing.kind === 'note' ? 'Add context for this option' : 'Type your answer'}
        paddingX={0}
      />
    </Box>
  );

  return (
    <Panel
      title="Ask"
      subtitle={questions.length > 1 ? `${answers.length + 1}/${questions.length} · ${question.id}` : undefined}
      header={
        <>
          <Prose bold>{question.prompt}</Prose>
          <Text> </Text>
        </>
      }
      hints={
        editing
          ? [
              ['Enter', 'save'],
              ['Esc', 'back'],
            ]
          : [
              ['Enter', 'select'],
              ['n', 'note'],
              ['Up/Down', 'move'],
              ['Esc', 'cancel'],
            ]
      }
    >
      {options.map((option, index) => (
        <OptionRow key={index} option={option} focused={index === focus} note={notes[index]}>
          {index === focus ? editor : undefined}
        </OptionRow>
      ))}
    </Panel>
  );
}

interface OptionRowProps {
  option: QuestionOption;
  focused: boolean;
  note?: string;
  /** Replaces the note line, e.g. with an editor. */
  children?: ReactNode;
}

export function OptionRow({ option, focused, note, children }: OptionRowProps) {
  const theme = useTheme();
  const color = focused ? theme.selection : undefined;

  return (
    <Box flexDirection="column">
      <Box>
        <Box flexShrink={0}>
          <Text color={color}>{focused ? '> ( ) ' : '  ( ) '}</Text>
        </Box>
        <Prose color={color}>
          {option.label}
          {option.recommended && ' (Recommended)'}
        </Prose>
      </Box>
      {option.description && (
        <Box paddingLeft={INDENT}>
          <Prose color={theme.muted}>{option.description}</Prose>
        </Box>
      )}
      {children ?? (note && <NoteLine note={note} />)}
    </Box>
  );
}

export function NoteLine({ note }: { note: string }) {
  const theme = useTheme();
  return (
    <Box paddingLeft={INDENT}>
      <Prose>
        <Text color={theme.muted}>note: </Text>
        {note}
      </Prose>
    </Box>
  );
}

export interface AskResultProps {
  questions: Question[];
  answers: QuestionAnswer[];
  cancelled?: boolean;
}

/** What was asked and what the user chose, kept in the transcript. */
export function AskResult({ questions, answers, cancelled = false }: AskResultProps) {
  const theme = useTheme();
  const count = questions.length === 1 ? '1 question' : `${questions.length} questions`;

  return (
    <Frame
      lead={1}
      tone={cancelled ? 'neutral' : 'success'}
      title={
        <Text>
          <Text color={cancelled ? theme.muted : theme.success}>{cancelled ? '[-]' : '[ok]'}</Text> Ask {count}
        </Text>
      }
    >
      {questions.flatMap((question, index) => {
        const answer = answers[index];
        const option = answer?.option === undefined ? undefined : question.options[answer.option];
        return [
          index > 0 && <FrameDivider key={`divider-${question.id}`} />,
          <Box key={question.id} flexDirection="column">
            <Prose bold>{question.prompt}</Prose>
            {answer ? (
              <Box>
                <Box flexShrink={0}>
                  <Text color={theme.selection}>{'  (o) '}</Text>
                </Box>
                <Prose>
                  {option ? (
                    <Text color={theme.selection}>{option.label}</Text>
                  ) : (
                    <Text>
                      <Text color={theme.muted}>Other: </Text>
                      <Text color={theme.selection}>{answer.text}</Text>
                    </Text>
                  )}
                  {option?.description && <Text color={theme.muted}> — {option.description}</Text>}
                </Prose>
              </Box>
            ) : (
              <Text color={theme.muted}>{cancelled ? '  cancelled' : '  no answer'}</Text>
            )}
            {answer?.note && <NoteLine note={answer.note} />}
          </Box>,
        ];
      })}
    </Frame>
  );
}
