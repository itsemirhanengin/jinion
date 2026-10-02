import { createContext, useContext } from 'react';
import type { ModelOption, ModelSelection, NoticeTone, Panels } from '@jinion/tui';
import type { CommandRegistry } from './commands/registry.js';
import type { SavedSession } from './session.js';
import type { SessionStore } from './session-store.js';

export interface AppInfo {
  version: string;
  cwd: string;
  /** Prompts the banner suggests trying. */
  examples?: string[];
}

export interface ModelState {
  /** The agent the models belong to, e.g. `Claude`. */
  agent: string;
  selection: ModelSelection;
  /** `undefined` until the agent has listed them. */
  options?: ModelOption[];
  /** The selected model's name, e.g. `Opus 5.5`, or its id until the models are known. */
  name: string;
}

/** Everything commands, panels and key handlers may do to the app. */
export interface AppActions {
  /** Handles text as if the user sent it: slash commands run, anything else goes to the agent. */
  submit(text: string): void;
  /** Sends text straight to the agent, skipping command handling. */
  prompt(text: string): void;
  /** Puts text in the prompt for the user to finish. */
  fill(text: string): void;
  notice(text: string, tone?: NoticeTone): void;
  /** Saves the current conversation and starts an empty one. */
  newSession(): void;
  /** Saves the current conversation and switches to `session`. */
  resume(session: SavedSession): void;
  /** Switches the model or effort from the next request on, and remembers it for later runs. */
  selectModel(selection: ModelSelection): void;
  toggleExpanded(): void;
  exit(): void;
}

export interface Jinion {
  info: AppInfo;
  model: ModelState;
  actions: AppActions;
  panels: Panels;
  commands: CommandRegistry;
  sessions: SessionStore;
  /** The conversation on screen. */
  sessionId: string;
}

/** `Opus 5.5 · high`, or just the name when the model's default effort is used. */
export const modelLabel = ({ name, selection }: ModelState) =>
  selection.effort ? `${name} · ${selection.effort}` : name;

export const JinionContext = createContext<Jinion | undefined>(undefined);

export function useJinion() {
  const jinion = useContext(JinionContext);
  if (!jinion) throw new Error('useJinion() must be called inside <App>.');
  return jinion;
}
