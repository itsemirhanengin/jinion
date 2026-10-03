import type { Question, QuestionAnswer } from '@jinion/tui/chat';
import { type Input, isObject } from './input.js';

export interface ClaudeQuestion {
  question: string;
  options: { label: string; description?: string }[];
  multiSelect?: boolean;
}

export function toQuestions(questions: ClaudeQuestion[]): Question[] {
  return questions.map((question) => ({
    id: question.question,
    prompt: question.question,
    options: question.options.map(({ label, description }) => ({ label, description })),
    multiple: question.multiSelect === true,
  }));
}

export function toClaudeAnswers(questions: ClaudeQuestion[], answers: QuestionAnswer[]) {
  const byQuestion: Record<string, string> = {};
  const annotations: Record<string, { notes: string }> = {};
  questions.forEach((question, index) => {
    const answer = answers[index];
    if (!answer) return;
    // Several picks go back as one comma-separated answer, the way AskUserQuestion takes them.
    const labels = answer.options.map((option) => question.options[option]?.label ?? '');
    byQuestion[question.question] = [...labels, ...(answer.text ? [answer.text] : [])].join(', ');
    if (answer.note) annotations[question.question] = { notes: answer.note };
  });
  return { answers: byQuestion, annotations };
}

export function fromClaudeAnswers(questions: ClaudeQuestion[], data: Input): QuestionAnswer[] {
  const answers = data.answers as Record<string, string>;
  const annotations = (isObject(data.annotations) ? data.annotations : {}) as Record<string, { notes?: string }>;
  return questions.map((question) => {
    const answer = answers[question.question] ?? '';
    const parts = question.multiSelect ? answer.split(', ') : [answer];
    const options = parts.flatMap((part) => {
      const option = question.options.findIndex((candidate) => candidate.label === part);
      return option >= 0 ? [option] : [];
    });
    const text = parts.filter((part) => part && !question.options.some((candidate) => candidate.label === part)).join(', ');
    const note = annotations[question.question]?.notes;
    return { options, ...(text ? { text } : {}), ...(note ? { note } : {}) };
  });
}
