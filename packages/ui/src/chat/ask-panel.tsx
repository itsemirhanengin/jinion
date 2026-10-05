import { Check, MessageCircleQuestion } from 'lucide-react';
import { type FormEvent, useState } from 'react';
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
}

/** What the agent asks to go on, one question at a time in the composer's place; sent once the last is answered. */
export function AskPanel({ questions, onAnswer }: AskPanelProps) {
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
      step={questions.length > 1 ? `${answers.length + 1} of ${questions.length}` : undefined}
      last={answers.length === questions.length - 1}
      onAnswer={answer}
      onBack={answers.length > 0 ? () => setAnswers(answers.slice(0, -1)) : undefined}
    />
  );
}

interface QuestionStepProps {
  question: Question;
  step?: string;
  last: boolean;
  onAnswer: (answer: QuestionAnswer) => void;
  onBack?: () => void;
}

/** One question: a single choice answers on a click; several, or words of one's own, answer with Next. */
function QuestionStep({ question, step, last, onAnswer, onBack }: QuestionStepProps) {
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

  return (
    <form onSubmit={submit} className="flex animate-enter flex-col gap-3 rounded-2xl bg-floating p-4 shadow-sm ring-1 ring-edge">
      <div className="flex items-start gap-2">
        <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 font-medium text-pretty">{question.prompt}</p>
        {step && <span className="shrink-0 text-faint tabular-nums">{step}</span>}
      </div>
      <div className="flex max-h-[40vh] flex-col gap-1 overflow-y-auto">
        {question.options.map((option, index) => {
          const on = chosen.includes(index);

          return (
            <button
              key={index}
              type="button"
              onClick={() => pick(index)}
              className={classNames('flex cursor-default items-start gap-3 rounded-lg px-3 py-2 text-left', on ? 'bg-selected' : 'hover:bg-shade')}
            >
              {question.multiple ? (
                <span
                  className={classNames(
                    'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded ring-1',
                    on ? 'bg-primary text-on-primary ring-primary' : 'ring-faint',
                  )}
                >
                  {on && <Check className="size-3" />}
                </span>
              ) : (
                <span className="mt-0.5 w-4 shrink-0 text-faint tabular-nums">{index + 1}</span>
              )}
              <span className="flex min-w-0 flex-col">
                <span>
                  {option.label}
                  {option.recommended && <span className="ml-1.5 text-muted">recommended</span>}
                </span>
                {option.description && <span className="text-pretty text-muted">{option.description}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {question.other !== false && (
        <input
          name="answer"
          aria-label="Your own answer"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Or say it in your own words"
          className="h-9 rounded-lg bg-background px-3 ring-1 ring-edge outline-none placeholder:text-faint focus:ring-primary/40"
        />
      )}
      {(onBack || question.multiple || typed) && (
        <div className="flex items-center gap-2">
          {onBack && (
            <Button size="small" onClick={onBack}>
              Back
            </Button>
          )}
          <span className="flex-1" />
          {(question.multiple || typed) && (
            <Button type="submit" variant="primary" size="small" disabled={!ready}>
              {last ? 'Send' : 'Next'}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}
