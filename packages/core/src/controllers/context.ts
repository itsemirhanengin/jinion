import type { NoticeTone } from '../conversation/entries.js';
import type { Action } from '../conversation/reducer.js';
import type { Store } from 'jotai/vanilla';
import type { AgentBackend, AgentSession } from '../agent/agent.js';
import type { SessionAtoms } from '../state/session.js';
import type { RewindPoint } from './conversation.js';

export interface AppInfo {
  version: string;
  cwd: string;
  examples?: string[];
}

/** Whether text put in a prompt replaces what is there, or goes before it, as queued messages coming back do. */
export type PromptFill = 'replace' | 'prepend';

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
export type View =
  | { id: 'help'; topic?: string }
  | { id: 'model' }
  | { id: 'mode' }
  | { id: 'account'; signIn?: string }
  | { id: 'mcp' }
  | { id: 'resume'; query?: string }
  | { id: 'memory' }
  | { id: 'rewind'; points: RewindPoint[] }
  | { id: 'diff'; turn?: string; file?: string }
  | { id: 'context' }
  | { id: 'usage'; tab: 'usage' | 'stats' }
  | { id: 'tasks' }
  | { id: 'statusline' };

/** What the app's controllers work with. */
export interface AppContext {
  store: Store;
  /** What every conversation shares: models, accounts, MCP servers, skills. */
  backend: AgentBackend;
  info: AppInfo;
  screen: Screen;
  /** In the conversation the user looks at. */
  notice(text: string, tone?: NoticeTone): void;
  /** Nothing while the user looks at what it is about. */
  notify(body: string): void;
}

/** What a session's controllers work with: the app's, and the session's own agent and atoms. */
export interface SessionContext extends AppContext {
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
