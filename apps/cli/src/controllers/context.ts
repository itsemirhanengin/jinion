import type { NoticeTone } from '../conversation/entries.js';
import type { PermissionDecision, PermissionRequest } from '../agent/permissions.js';
import type { Question, QuestionAnswer } from '../agent/questions.js';
import type { Store } from 'jotai/vanilla';
import type { Agent, AgentMode, PlanDecision } from '../agent/agent.js';
import type { RewindPoint } from './conversation.js';

export interface AppInfo {
  version: string;
  cwd: string;
  examples?: string[];
}

/** Implemented by each client, so controllers draw nothing. */
export interface Screen {
  openView(view: View): void;
  showDialog(dialog: Dialog): void;
  closeDialog(id: Dialog['id']): void;
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

export type Dialog =
  | { id: 'ask'; questions: Question[]; onSubmit(answers: QuestionAnswer[]): void; onCancel(): void }
  | { id: 'permission'; request: PermissionRequest; onDecide(decision: PermissionDecision): void; onCancel(): void }
  | { id: 'plan'; modes: AgentMode[]; onDecide(decision: PlanDecision): void; onCancel(): void };

export interface Context {
  store: Store;
  agent: Agent;
  info: AppInfo;
  screen: Screen;
  notice(text: string, tone?: NoticeTone): void;
  /** Nothing while the user looks at this window. */
  notify(body: string): void;
}

export const BUSY = 'Finish or interrupt the current turn first (esc).';
