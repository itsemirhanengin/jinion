import type { NotificationMethod, PanelSpec } from '@jinion/tui';
import type { NoticeTone, PermissionDecision, PermissionRequest, PlanPanelDecision, Question, QuestionAnswer } from '@jinion/tui/chat';
import type { Store } from 'jotai';
import type { Agent, AgentMode } from '../agent/agent.js';

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
  readonly notificationMethod: NotificationMethod;
  toggleExpanded(): void;
  exit(): void;
}

export type Dialog =
  | { id: 'ask'; questions: Question[]; onSubmit(answers: QuestionAnswer[]): void; onCancel(): void }
  | { id: 'permission'; request: PermissionRequest; onDecide(decision: PermissionDecision): void; onCancel(): void }
  | { id: 'plan'; modes: AgentMode[]; onDecide(decision: PlanPanelDecision): void; onCancel(): void };

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
