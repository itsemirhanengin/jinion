import { ArrowUp, Check, MessageCircleQuestion } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, type ReactNode, useState } from 'react';
import { classNames } from '../lib/class-names.js';
import { Button } from '../primitives/button.js';

export interface QuestionOption {
  label: string;
  description?: string;
  recommended?: boolean;
}

export interface Question {
  id: string;
  prompt: string;
  options: QuestionOption[];
  multiple?: boolean;
  /** `false` leaves out the answer typed in one's own words. */
  other?: boolean;
}

/** By the options' indexes, or typed in one's own words as `text`. */
export interface QuestionAnswer {
  options: number[];
  text?: string;
  note?: string;
}

export interface AskPanelProps {
  questions: Question[];
  onAnswer: (answers: QuestionAnswer[]) => void;
  /** The first line inside the box, as in the composer, such as the running turn's todos. */
  header?: ReactNode;
}

/** What the agent asks to go on, one question at a time in the composer's place; sent once the last is answered. */
export function AskPanel({ questions, onAnswer, header }: AskPanelProps) {
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);

  const question = questions[answers.length];
  if (!question) return null;

  const answer = (value: QuestionAnswer) => {
    const next = [...answers, value];

    if (next.length === questions.length) onAnswer(next);
    else setAnswers(next);
  };

  return (
    <QuestionStep
      key={answers.length}
      question={question}
      header={header}
      step={questions.length > 1 ? `${answers.length + 1} of ${questions.length}` : undefined}
      onAnswer={answer}
      onBack={answers.length > 0 ? () => setAnswers(answers.slice(0, -1)) : undefined}
    />
  );
}

interface QuestionStepProps {
  question: Question;
  header?: ReactNode;
  step?: string;
  onAnswer: (answer: QuestionAnswer) => void;
  onBack?: () => void;
}

/**
 * One question in the composer's own box: the question as its first line, the options as lines of the conversation's
 * height, then the composer's field for words of one's own. A single choice answers on a click; several, or words,
 * answer with the send button.
 */
function QuestionStep({ question, header, step, onAnswer, onBack }: QuestionStepProps) {
  const [chosen, setChosen] = useState<number[]>([]);
  const [text, setText] = useState('');

  const typed = text.trim();
  const ready = chosen.length > 0 || typed !== '';

  const pick = (option: number) => {
    if (!question.multiple) {
      onAnswer({ options: [option] });

      return;
    }

    setChosen((all) => (all.includes(option) ? all.filter((each) => each !== option) : [...all, option]));
  };

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (ready) onAnswer({ options: question.multiple ? chosen : [], text: typed || undefined });
  };

  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    submit();
  };

  return (
    <form onSubmit={submit} className="animate-enter rounded-2xl bg-floating shadow-sm ring-1 ring-edge">
      {header}
      <div className="flex items-start gap-2 px-4 pt-2.5 pb-1">
        <span className="flex h-5 w-4 shrink-0 items-center justify-center text-faint [&_svg]:size-3.5">
          <MessageCircleQuestion />
        </span>
        <p className="min-w-0 flex-1 font-medium text-pretty">{question.prompt}</p>
        {step && <span className="shrink-0 text-faint tabular-nums">{step}</span>}
      </div>
      <div className="flex max-h-[40vh] flex-col overflow-y-auto px-2">
        {question.options.map((option, index) => {
          const on = chosen.includes(index);

          return (
            <button
              key={index}
              type="button"
              onClick={() => pick(index)}
              className={classNames('flex min-h-7 cursor-default items-start gap-2 rounded-lg px-2 py-1 text-left', on ? 'bg-selected' : 'hover:bg-shade')}
            >
              <span className="flex h-5 w-4 shrink-0 items-center justify-center">
                {question.multiple ? (
                  <span className={classNames('flex size-3.5 items-center justify-center rounded-[4px] ring-1', on ? 'bg-primary text-on-primary ring-primary' : 'ring-faint')}>
                    {on && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                ) : (
                  <span className="text-faint tabular-nums">{index + 1}</span>
                )}
              </span>
              <span className="min-w-0 text-pretty">
                {option.label}
                {option.recommended && <span className="text-muted"> · recommended</span>}
                {option.description && <span className="text-faint"> — {option.description}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {question.other !== false && (
        <textarea
          name="answer"
          aria-label="Your own answer"
          value={text}
          rows={1}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={keyDown}
          placeholder="Or answer in your own words"
          className="field-sizing-content mt-1 block max-h-40 min-h-9 w-full resize-none border-t border-line bg-transparent px-4 pt-2.5 outline-none placeholder:text-faint"
        />
      )}
      <div className="flex items-center gap-1 px-2 pb-2">
        {onBack && (
          <Button size="small" onClick={onBack}>
            Back
          </Button>
        )}
        <span className="flex-1" />
        <button
          type="submit"
          aria-label="Send"
          title="Send"
          disabled={!ready}
          className={classNames('flex size-7 cursor-default items-center justify-center rounded-full text-on-primary', ready ? 'bg-primary' : 'bg-primary/30')}
        >
          <ArrowUp className="size-4 shrink-0" />
        </button>
      </div>
    </form>
  );
}
