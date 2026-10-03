import { createContext, useContext } from 'react';
import type { ModelOption, ModelSelection, NoticeTone, NotificationMethod, Panels } from '@jinion/tui';
import type {
  AgentAccount,
  AgentAccounts,
  AgentCommand,
  AgentMcp,
  AgentMode,
  AgentUsage,
  BackgroundTask,
  ContextUsage,
  UsageHistory,
} from './agent/types.js';
import type { CommandRegistry } from './commands/registry.js';
import type { EditTurn, SavedSession } from './session.js';
import type { MemoryStore } from './memory/store.js';
import type { SessionStore } from './session-store.js';
import type { SeenLimits } from './settings.js';
import type { StatusItem } from './status/line.js';
import type { StatusData } from './status/segments.js';

export interface AppInfo {
  version: string;
  /** Absolute. */
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
  /** Switches the agent's mode right away; the project starts in it next time. */
  selectMode(mode: AgentMode): void;
  /** Switches to another of the agent's logins between turns; the conversation carries on there. */
  selectAccount(name: string): void;
  /** An account signed in again; the one in use carries the conversation on with the new login, after the turn. */
  accountSignedIn(name: string): void;
  /** Signs an account out and forgets it; settles once it is done or said why it couldn't be. */
  removeAccount(name: string): Promise<void>;
  /** Shows `items` in the status line until saved or reverted with `undefined`. */
  previewStatusLine(items: StatusItem[] | undefined): void;
  saveStatusLine(items: StatusItem[]): void;
  /** Opens the rewind panel, to go back to before an earlier message. */
  rewind(): void;
  /** Names the conversation `name`, which stays; without one, the agent names it now and again as it moves on. */
  rename(name?: string): void;
  /** Summarizes the conversation to free context, keeping what `focus` says above all. */
  compact(focus?: string): void;
  /** Opens the panel of background tasks. */
  openTasks(): void;
  /** Stops a background task; it shows as stopped once the agent says so. */
  stopTask(id: string): void;
  /** Turns notifications on or off, from now on and in later runs. */
  setNotifications(on: boolean): void;
  /** Asks the agent for its skills and MCP prompts again, e.g. after servers were turned on or off. */
  reloadCommands(): void;
  toggleExpanded(): void;
  exit(): void;
}

export interface Jinion {
  info: AppInfo;
  model: ModelState;
  modes: { current: AgentMode; available: AgentMode[] };
  /** The saved status line and the data its segments show. */
  status: { items: StatusItem[]; data: StatusData };
  /** The agent's logins, if it has several, who it runs as, and the plan limits last seen for each. */
  accounts: { manager?: AgentAccounts; current?: string; identity?: AgentAccount; seen: SeenLimits };
  /** The agent's MCP servers, if it has any. */
  mcp?: AgentMcp;
  /** What the agent reports of its usage, for `/usage`; agents that report none leave these out. */
  usage: {
    current?(options?: { drivers?: boolean }): Promise<AgentUsage>;
    history?(progress?: (done: number, total: number) => void): Promise<UsageHistory>;
    context?(): Promise<ContextUsage>;
  };
  actions: AppActions;
  panels: Panels;
  commands: CommandRegistry;
  /** The agent's skills and MCP prompts, mentioned as `$name`, and the pattern that highlights them. */
  skills: { list: AgentCommand[]; mention?: RegExp };
  sessions: SessionStore;
  memory: MemoryStore;
  /** The files the agent changed in this conversation, subagents included, as absolute paths. */
  edited: Set<string>;
  /** The turns in which it changed them, newest first, for `/diff`. */
  turns: EditTurn[];
  /** The agent's background tasks, running or ended, and a command or subagent the turn waits for, `foreground`. */
  tasks: BackgroundTask[];
  /** Whether jinion notifies when it waits for the user or ends a long turn in an unfocused window, and how. */
  notifications: { on: boolean; method: NotificationMethod };
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
