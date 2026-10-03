import { useState } from 'react';
import { Text } from 'ink';
import { useTheme } from '../../runtime/theme.js';
import { ChoiceList, choiceIndent, useChoiceList, type Choice } from '../../primitives/choice-list.js';
import { Panel } from '../../primitives/panel.js';
import { Prose } from '../../primitives/prose.js';
import { EDITOR_HINTS, OptionEditor, useOptionEditor } from '../option-editor.js';
import type { Question, QuestionAnswer } from './question.js';

const OTHER = 'other';

interface Editing {
  kind: 'note' | 'other';
  key: string;
  value: string;
}

export interface AskPanelProps {
  questions: Question[];
  onSubmit(answers: QuestionAnswer[]): void;
  onCancel(): void;
}

export function AskPanel({ questions, onSubmit, onCancel }: AskPanelProps) {
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);

  const question = questions[answers.length];

  const answer = (value: QuestionAnswer) => {
    const next = [...answers, value];

    if (next.length === questions.length) onSubmit(next);
    else setAnswers(next);
  };

  if (!question) return null;

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

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [other, setOther] = useState('');

  const [editing, setEditing] = useOptionEditor<Editing>(() =>
    list.focus === OTHER ? undefined : { kind: 'note', key: list.focus, value: notes[list.focus] ?? '' },
  );

  const multiple = question.multiple === true;
  const keys = [...question.options.map((_, index) => String(index)), OTHER];

  const finish = (picked: string[], otherText = other) => {
    const options = picked.filter((key) => key !== OTHER).map(Number);
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
    <OptionEditor
      indent={choiceIndent(list)}
      note={editing.kind === 'note'}
      value={editing.value}
      onChange={(value) => setEditing({ ...editing, value })}
      onSubmit={save}
      placeholder={editing.kind === 'note' ? 'Add context for this option' : 'Type your answer'}
    />
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
          ? EDITOR_HINTS
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
