import type { Store } from 'jotai/vanilla';
import { z } from 'zod';
import type { AgentBackend, AgentSession } from '../agent/agent.js';
import type { NoticeTone } from '../conversation/entries.js';
import type { Action } from '../conversation/reducer.js';
import type { SessionAtoms } from '../state/session.js';

export const AppInfo = z.object({ version: z.string(), cwd: z.string(), examples: z.array(z.string()).optional() });

export type AppInfo = z.infer<typeof AppInfo>;

/** Whether text put in a prompt replaces what is there, or goes before it, as queued messages coming back do. */
export const PromptFill = z.enum(['replace', 'prepend']);

export type PromptFill = z.infer<typeof PromptFill>;

/** A message the conversation can go back to, as `/rewind` lists them. */
export const RewindPoint = z.object({ entry: z.string(), promptId: z.string(), text: z.string() });

export type RewindPoint = z.infer<typeof RewindPoint>;

/** Implemented by each client, so controllers draw nothing. */
export interface Screen {
  openView(view: View): void;
  /** The draft is the client's; the core only puts text in it, e.g. the message a rewind went back to. */
  fillPrompt(session: string, text: string, fill: PromptFill): void;
  focused(): boolean;
  notify(title: string, body: string): void;
  /** How this client tells the user something while they look elsewhere. */
  readonly notifications: 'desktop' | 'bell';
  toggleExpanded(): void;
  exit(): void;
}

/** What a command asks to see; each client draws it its own way. */
export const View = z.discriminatedUnion('id', [
  z.object({ id: z.literal('help'), topic: z.string().optional() }),
  z.object({ id: z.literal('model') }),
  z.object({ id: z.literal('mode') }),
  z.object({ id: z.literal('account'), signIn: z.string().optional() }),
  z.object({ id: z.literal('mcp') }),
  z.object({ id: z.literal('resume'), query: z.string().optional() }),
  z.object({ id: z.literal('memory') }),
  z.object({ id: z.literal('rewind'), points: z.array(RewindPoint) }),
  z.object({ id: z.literal('diff'), turn: z.string().optional(), file: z.string().optional() }),
  z.object({ id: z.literal('context') }),
  z.object({ id: z.literal('usage'), tab: z.enum(['usage', 'stats']) }),
  z.object({ id: z.literal('tasks') }),
  z.object({ id: z.literal('statusline') }),
]);

export type View = z.infer<typeof View>;

/** What the app's controllers work with. */
export interface AppContext {
  store: Store;
  /** Each holds what its conversations share: models, accounts, MCP servers, skills. */
  backends: readonly AgentBackend[];
  /** The backend of the session the user looks at, whose accounts and servers the app's views show. */
  activeBackend(): AgentBackend;
  info: AppInfo;
  screen: Screen;
  /** In the conversation the user looks at. */
  notice(text: string, tone?: NoticeTone): void;
  /** Nothing while the user looks at what it is about. */
  notify(body: string): void;
}

/** What a session's controllers work with: the app's, and the session's own backend, agent and atoms. */
export interface SessionContext extends AppContext {
  /** Both change when the conversation moves to another backend, so they are read where they are used. */
  backend: AgentBackend;
  agent: AgentSession;
  atoms: SessionAtoms;
  /** The one way a conversation changes. */
  dispatch(action: Action): void;
  /** In this session's conversation, whichever the user looks at. */
  notice(text: string, tone?: NoticeTone): void;
  /** In this session's prompt. */
  fillPrompt(text: string, fill: PromptFill): void;
}

export const BUSY = 'Finish or interrupt the current turn first (esc).';
