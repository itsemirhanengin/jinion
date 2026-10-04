import { z } from 'zod';
import { AgentMode, type PlanDecision } from '../agent/agent.js';
import { type PermissionDecision, PermissionRequest } from '../agent/permissions.js';
import { Question, type QuestionAnswer } from '../agent/questions.js';

/** What a session waits for the user to answer, as data a client draws and answers through the session. */
export const Dialog = z.discriminatedUnion('id', [
  z.object({ id: z.literal('ask'), questions: z.array(Question) }),
  z.object({ id: z.literal('permission'), request: PermissionRequest }),
  z.object({ id: z.literal('plan'), modes: z.array(AgentMode) }),
]);

export type Dialog = z.infer<typeof Dialog>;

export interface DialogAnswers {
  ask: QuestionAnswer[];
  permission: PermissionDecision;
  plan: PlanDecision;
}

export type DialogAnswer = DialogAnswers[Dialog['id']];
