import { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../runtime/context.js';
import { ChoiceList, choiceIndent, useChoiceList, type Choice } from '../primitives/choice-list.js';
import { Frame, FrameDivider } from '../primitives/frame.js';
import { NoteLine } from '../primitives/option-row.js';
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
  /** Lets the user pick any number of the options instead of one. */
  multiple?: boolean;
}

export interface QuestionAnswer {
  /** Indexes of the picked options: one for a single choice, any number for `multiple`. */
  options: number[];
  /** The user's own answer, given through "Other". */
  text?: string;
  note?: string;
}

const OTHER = 'other';

interface Editing {
  kind: 'note' | 'other';
  /** The option a note belongs to. */
  key: string;
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
 *     | > 1. api (Recommended)          |
 *     |      NestJS backend             |
 *     |   2. Other (type your own)      |
 *     +---------------------------------+
 *     | Enter select · n note · ...     |
 *     +---------------------------------+
 *
 * A `multiple` question puts `[x]` boxes in front of the options; space checks them and enter submits.
 */
export function AskPanel({ questions, onSubmit, onCancel }: AskPanelProps) {
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const question = questions[answers.length];
  if (!question) return null;

  const answer = (value: QuestionAnswer) => {
    const next = [...answers, value];
    if (next.length === questions.length) onSubmit(next);
    else setAnswers(next);
  };

  return (
    <QuestionStep
      key={answers.length}
      question={question}
      step={questions.length > 1 ? `${answers.length + 1}/${questions.length} · ${question.id}` : undefined}
      onAnswer={answer}
      onCancel={onCancel}
    />
  );
}

interface QuestionStepProps {
  question: Question;
  step?: string;
  onAnswer(answer: QuestionAnswer): void;
  onCancel(): void;
}

function QuestionStep({ question, step, onAnswer, onCancel }: QuestionStepProps) {
  const theme = useTheme();
  const multiple = question.multiple === true;
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [other, setOther] = useState('');
  const [editing, setEditing] = useState<Editing>();
  const keys = [...question.options.map((_, index) => String(index)), OTHER];

  const finish = (picked: string[], otherText = other) => {
    const options = picked.filter((key) => key !== OTHER).map(Number);
    // Notes of several picked options become one, each under its option's name.
    const written = picked.filter((key) => notes[key]);
    const note =
      written.length === 1 && !multiple
        ? notes[written[0]!]
        : written.map((key) => `${question.options[Number(key)]?.label}: ${notes[key]}`).join('; ') || undefined;
    onAnswer({ options, ...(picked.includes(OTHER) && otherText ? { text: otherText } : {}), ...(note ? { note } : {}) });
  };

  const list = useChoiceList({
    keys,
    mode: multiple ? 'multiple' : 'single',
    isActive: !editing,
    onCancel,
    onSubmit: (picked) => {
      if (!multiple && picked[0] === OTHER) return setEditing({ kind: 'other', key: OTHER, value: other });
      if (picked.length > 0) finish(picked);
    },
    // "Other" only counts once it says something.
    onToggle: (key) => {
      if (key !== OTHER || list.isChecked(OTHER)) return;
      setEditing({ kind: 'other', key: OTHER, value: other });
      return false;
    },
  });

  useInput(
    (input) => {
      if (input === 'n' && list.focus !== OTHER) setEditing({ kind: 'note', key: list.focus, value: notes[list.focus] ?? '' });
    },
    { isActive: !editing },
  );
  useInput(
    (_, key) => {
      if (key.escape) setEditing(undefined);
    },
    { isActive: editing !== undefined },
  );

  const save = (value: string) => {
    const text = value.trim();
    if (!editing) return;
    setEditing(undefined);
    if (editing.kind === 'note') {
      return setNotes(({ [editing.key]: _, ...rest }) => (text ? { ...rest, [editing.key]: text } : rest));
    }
    setOther(text);
    if (!multiple) {
      if (text) finish([OTHER], text);
    } else list.setChecked(OTHER, text !== '');
  };

  const editor = editing && (
    <Box paddingLeft={choiceIndent(list)}>
      {editing.kind === 'note' && <Text color={theme.muted}>note: </Text>}
      <PromptInput
        value={editing.value}
        onChange={(value) => setEditing({ ...editing, value })}
        onSubmit={save}
        placeholder={editing.kind === 'note' ? 'Add context for this option' : 'Type your answer'}
        paddingX={0}
      />
    </Box>
  );

  const choices: Choice[] = [
    ...question.options.map((option, index) => ({
      key: String(index),
      label: option.recommended ? `${option.label} (Recommended)` : option.label,
      description: option.description,
      note: notes[String(index)],
      editor: editing?.key === String(index) ? editor || undefined : undefined,
    })),
    {
      key: OTHER,
      label: other ? `Other: ${other}` : 'Other (type your own)',
      editor: editing?.key === OTHER ? editor || undefined : undefined,
    },
  ];

  return (
    <Panel
      title="Ask"
      subtitle={step}
      header={
        <>
          <Prose>
            <Text bold>{question.prompt}</Text>
            {multiple && <Text color={theme.muted}>  pick any</Text>}
          </Prose>
          <Text> </Text>
        </>
      }
      hints={
        editing
          ? [
              ['Enter', 'save'],
              ['Esc', 'back'],
            ]
          : multiple
            ? [
                ['Space', 'select'],
                ['Enter', 'submit'],
                ['n', 'note'],
                ['Up/Down', 'move'],
                ['Esc', 'cancel'],
              ]
            : [
                ['Enter', 'select'],
                ['n', 'note'],
                ['Up/Down', 'move'],
                ['Esc', 'cancel'],
              ]
      }
    >
      <ChoiceList list={list} choices={choices} limit={choices.length} />
    </Panel>
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
        // Picked options keep their numbers from the panel; "Other" is the one after the listed options.
        const picked = [
          ...(answer?.options ?? []).map((option) => ({ number: option + 1, option: question.options[option] })),
          ...(answer?.text ? [{ number: question.options.length + 1, option: undefined }] : []),
        ];
        const indent = `  ${question.options.length + 1}. `.length;
        return [
          index > 0 && <FrameDivider key={`divider-${question.id}`} />,
          <Box key={question.id} flexDirection="column">
            <Prose bold>{question.prompt}</Prose>
            {picked.length > 0 ? (
              picked.map(({ number, option }) => (
                <Box key={number}>
                  <Box flexShrink={0} width={indent}>
                    <Text color={theme.selection}>{`  ${number}.`}</Text>
                  </Box>
                  <Prose>
                    {option ? (
                      <Text color={theme.selection}>{option.label}</Text>
                    ) : (
                      <Text>
                        <Text color={theme.muted}>Other: </Text>
                        <Text color={theme.selection}>{answer?.text}</Text>
                      </Text>
                    )}
                    {option?.description && <Text color={theme.muted}> — {option.description}</Text>}
                  </Prose>
                </Box>
              ))
            ) : (
              <Text color={theme.muted}>{cancelled ? '  cancelled' : '  no answer'}</Text>
            )}
            {answer?.note && <NoteLine note={answer.note} indent={indent} />}
          </Box>,
        ];
      })}
    </Frame>
  );
}
