import { describe, expect, it } from 'vitest';
import { type ClaudeQuestion, fromClaudeAnswers, toClaudeAnswers, toQuestions } from './questions.js';

const questions: ClaudeQuestion[] = [
  { question: 'Which database?', options: [{ label: 'Postgres', description: 'Relational' }, { label: 'SQLite' }] },
  { question: 'Which tests?', options: [{ label: 'Unit' }, { label: 'E2E' }], multiSelect: true },
];

describe('questions', () => {
  it('asks Claude Code’s questions as Jinion’s', () => {
    expect(toQuestions(questions)[1]).toEqual({
      id: 'Which tests?',
      prompt: 'Which tests?',
      options: [{ label: 'Unit', description: undefined }, { label: 'E2E', description: undefined }],
      multiple: true,
    });
  });

  it('sends answers back as AskUserQuestion takes them, and reads them from its result the same', () => {
    const answers = [{ options: [1], note: 'keep it small' }, { options: [0, 1], text: 'Smoke' }];
    const claude = toClaudeAnswers(questions, answers);
    expect(claude).toEqual({
      answers: { 'Which database?': 'SQLite', 'Which tests?': 'Unit, E2E, Smoke' },
      annotations: { 'Which database?': { notes: 'keep it small' } },
    });
    expect(fromClaudeAnswers(questions, claude)).toEqual(answers);
  });
});
