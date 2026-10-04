import { z } from 'zod';
import type { AgentMode, PlanDecision } from '../agent/agent.js';
import type { PermissionDecision } from '../agent/permissions.js';
import type { QuestionAnswer } from '../agent/questions.js';
import type { AppInfo, PromptFill, View } from '../controllers/context.js';
import type { SentAction } from '../controllers/session.js';
import type { Submission } from '../prompt/submission.js';
import type { SessionState } from '../conversation/session.js';
import type { AppFields, FieldChange, SessionFields } from './fields.js';

/** Raised when a change would break a client written for the one before. */
export const PROTOCOL_VERSION = 1;

/** The protocol's own error codes, in the range JSON-RPC leaves to it. */
export const ApiCode = {
  notInitialized: -32001,
  unsupportedVersion: -32002,
  unknownSession: -32003,
  dialogGone: -32004,
} as const;

const session = z.object({ session: z.string() });

const mode = z.enum(['manual', 'edits', 'plan', 'auto']) satisfies z.ZodType<AgentMode>;

const submission = z.object({
  text: z.string(),
  prompt: z
    .object({ text: z.string(), images: z.array(z.object({ mediaType: z.string(), data: z.string() })).optional() })
    .optional(),
}) satisfies z.ZodType<Submission>;

const questionAnswer = z.object({
  options: z.array(z.number().int().nonnegative()),
  text: z.string().optional(),
  note: z.string().optional(),
}) satisfies z.ZodType<QuestionAnswer>;

const permissionDecision = z.union([
  z.object({ allow: z.literal(true), always: z.boolean().optional() }),
  z.object({ allow: z.literal(false), note: z.string().optional() }),
]) satisfies z.ZodType<PermissionDecision>;

const planDecision = z.union([
  z.object({ approve: z.literal(true), mode }),
  z.object({ approve: z.literal(false), note: z.string().optional() }),
]) satisfies z.ZodType<PlanDecision>;

/** The params of everything a client sends, checked where they come in, since a client may be any program. */
export const clientSchemas = {
  initialize: z.object({
    protocolVersion: z.number().int(),
    client: z.object({ name: z.string(), version: z.string() }),
    /** How this client tells the user something while they look elsewhere. */
    notifications: z.enum(['desktop', 'bell']).optional(),
  }),
  /** A new conversation, or the saved one `resume` names. */
  'sessions/open': z.object({ resume: z.string().optional(), worktree: z.boolean().optional() }),
  'sessions/activate': session,
  'sessions/close': session,
  /** Answered with the conversation as it is; every change after it comes as `session/action`. */
  'session/subscribe': session,
  'session/unsubscribe': session,
  /** What the user sent: a prompt, a message for the running turn, or a slash command. */
  'session/submit': session.extend(submission.shape),
  'session/interrupt': session,
  /** Names the dialog it answers, so an answer meant for one that is gone answers nothing else. */
  'dialog/answer': z.discriminatedUnion('dialog', [
    session.extend({ dialog: z.literal('ask'), answer: z.array(questionAnswer) }),
    session.extend({ dialog: z.literal('permission'), answer: permissionDecision }),
    session.extend({ dialog: z.literal('plan'), answer: planDecision }),
  ]),
  'dialog/cancel': session,
  'client/focus': z.object({ focused: z.boolean() }),
};

type ClientParams = { [M in keyof typeof clientSchemas]: z.infer<(typeof clientSchemas)[M]> };

export interface SessionSummary {
  id: string;
  title?: string;
  working: boolean;
}

/** The open sessions, in the order they opened, and the one the user looks at. */
export interface Sessions {
  sessions: SessionSummary[];
  active?: string;
}

/** `seq` is the session's last action; each `session/action` after it carries the next number. */
export interface SessionSnapshot {
  state: SessionState;
  fields: SessionFields;
  seq: number;
}

export interface Initialized extends Sessions {
  protocolVersion: number;
  server: { name: string; version: string };
  info: AppInfo;
  app: AppFields;
}

interface ServerResults {
  initialize: Initialized;
  'sessions/open': { session: string };
  'sessions/activate': null;
  /** `false` when the user chose to keep it open, e.g. over a worktree with work in it. */
  'sessions/close': { closed: boolean };
  'session/subscribe': SessionSnapshot;
  'session/unsubscribe': null;
  'session/submit': null;
  'session/interrupt': null;
  'dialog/answer': null;
  'dialog/cancel': null;
}

/** What the server answers. */
export type ServerContract = {
  requests: { [M in keyof ServerResults]: { params: ClientParams[M]; result: ServerResults[M] } };
  notifications: { 'client/focus': ClientParams['client/focus'] };
};

/** What a client answers: for now only what the server tells it. */
export type ClientContract = {
  requests: Record<never, never>;
  notifications: {
    'sessions/changed': Sessions;
    'session/action': SentAction & { session: string };
    'session/field': FieldChange<SessionFields> & { session: string };
    'app/field': FieldChange<AppFields>;
    /** A command asked to show something, such as a picker. */
    'screen/view': { view: View };
    /** Text for the prompt of `session`, e.g. the message a rewind went back to. */
    'screen/fill-prompt': { session: string; text: string; fill: PromptFill };
    'screen/notify': { title: string; body: string };
    'screen/expand': Record<never, never>;
    'screen/exit': Record<never, never>;
  };
};
