import type { PanelSpec } from '@jinion/tui';
import type { NoticeTone } from '../conversation/entries.js';
import type { PermissionDecision, PermissionRequest } from '../agent/permissions.js';
import type { Question, QuestionAnswer } from '../agent/questions.js';
import type { Store } from 'jotai/vanilla';
import type { Agent, AgentMode, PlanDecision } from '../agent/agent.js';

export interface AppInfo {
  version: string;
  cwd: string;
  examples?: string[];
}

/** Implemented by the app with the TUI, so controllers stay free of React. */
export interface Screen {
  openPanel(panel: PanelSpec): void;
  closePanel(id?: string): void;
  topPanel(): string | undefined;
  showDialog(dialog: Dialog): void;
  focused(): boolean;
  notify(title: string, body: string): void;
  /** How this client tells the user something while they look elsewhere. */
  readonly notifications: 'desktop' | 'bell';
  toggleExpanded(): void;
  exit(): void;
}

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
