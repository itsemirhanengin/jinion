import { Check, MessageCircleQuestion } from 'lucide-react';
import { useState } from 'react';
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

/** What the agent asks to go on, in the composer's place; sent once every question has an answer. */
export function AskPanel({ questions, onAnswer }: AskPanelProps) {
  const [answers, setAnswers] = useState<QuestionAnswer[]>(() => questions.map(() => ({ options: [] })));

  const answered = answers.every((answer) => answer.options.length > 0 || answer.text?.trim());

  const pick = (question: number, option: number) =>
    setAnswers((all) =>
      all.map((answer, index) => {
        if (index !== question) return answer;
        if (!questions[index]!.multiple) return { options: [option] };

        const options = answer.options.includes(option) ? answer.options.filter((each) => each !== option) : [...answer.options, option];

        return { ...answer, options };
      }),
    );

  const type = (question: number, text: string) =>
    setAnswers((all) => all.map((answer, index) => (index === question ? { options: questions[index]!.multiple ? answer.options : [], text } : answer)));

  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto rounded-2xl border border-working/40 bg-raised p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
      {questions.map((question, index) => (
        <div key={question.id} className="flex flex-col gap-2">
          <div className="flex items-start gap-2 font-medium">
            <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-working" />
            {question.prompt}
          </div>
          <div className="flex flex-col gap-1 pl-6">
            {question.options.map((option, optionIndex) => {
              const chosen = answers[index]!.options.includes(optionIndex);

              return (
                <button
                  key={optionIndex}
                  type="button"
                  onClick={() => pick(index, optionIndex)}
                  className={classNames(
                    'flex cursor-default items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                    chosen ? 'border-working/50 bg-working/5' : 'border-line hover:bg-hover/50',
                  )}
                >
                  <span
                    className={classNames(
                      'mt-0.5 flex size-4 shrink-0 items-center justify-center border',
                      question.multiple ? 'rounded' : 'rounded-full',
                      chosen ? 'border-working bg-working text-on-primary' : 'border-faint',
                    )}
                  >
                    {chosen && <Check className="size-3" />}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span>
                      {option.label}
                      {option.recommended && <span className="ml-1.5 text-small text-accent">recommended</span>}
                    </span>
                    {option.description && <span className="text-small text-muted">{option.description}</span>}
                  </span>
                </button>
              );
            })}
            {question.other !== false && (
              <input
                value={answers[index]!.text ?? ''}
                onChange={(event) => type(index, event.target.value)}
                placeholder="Or say it in your own words"
                className="h-9 rounded-lg border border-line bg-canvas px-3 outline-none placeholder:text-faint focus:border-ink/30"
              />
            )}
          </div>
        </div>
      ))}
      <div className="flex justify-end">
        <Button variant="primary" size="small" disabled={!answered} onClick={() => onAnswer(answers)}>
          Send
        </Button>
      </div>
    </div>
  );
}
