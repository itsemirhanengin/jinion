import type { AgentMode, PlanDecision } from '../agent/agent.js';
import type { PermissionDecision, PermissionRequest } from '../agent/permissions.js';
import type { Question, QuestionAnswer } from '../agent/questions.js';

/** What a session waits for the user to answer, as data a client draws and answers through the session. */
export type Dialog = { id: 'ask'; questions: Question[] } | { id: 'permission'; request: PermissionRequest } | { id: 'plan'; modes: AgentMode[] };

export interface DialogAnswers {
  ask: QuestionAnswer[];
  permission: PermissionDecision;
  plan: PlanDecision;
}

export type DialogAnswer = DialogAnswers[Dialog['id']];
