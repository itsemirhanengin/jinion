import { atom } from 'jotai/vanilla';
import type { AgentMode, SessionFeatures } from '../agent/agent.js';
import { modelLabel, modelName, type ModelSelection } from '../agent/models.js';
import type { BackgroundTask } from '../agent/tasks.js';
import type { Dialog } from '../conversation/dialogs.js';
import { editTurns } from '../conversation/edits.js';
import { reduce, type StampedAction } from '../conversation/reducer.js';
import type { SessionState } from '../conversation/session.js';
import type { Submission } from '../prompt/submission.js';
import { modelsAtom } from './agent.js';

export const DEFAULT_CONTEXT_WINDOW = 200_000;

export interface SessionStart {
  /** With `agent` set. */
  state: SessionState;
  features: SessionFeatures;
  selection: ModelSelection;
  mode: AgentMode;
  /** Whether the conversation gets a git worktree of its own with its first message. */
  worktree: boolean;
}

/** `id` is the one the agent's `steer` gave it; `prompt` what the agent got when pastes made it longer. */
export interface Steered {
  id: string;
  text: string;
  prompt?: string;
}

/** One session's atoms, in the app's one store. Its controllers read and write these only, never another session's. */
export function sessionAtoms({ state: initial, features, selection: initialSelection, mode, worktree }: SessionStart) {
  const state = atom(initial);
  const agent = atom((get) => get(state).agent ?? '');
  const models = atom((get) => get(modelsAtom)[get(agent)]);
  const entries = atom((get) => get(state).entries);
  const busySince = atom((get) => get(state).busySince);
  const busy = atom((get) => get(busySince) !== undefined);
  /** Set from the moment a turn starts, before the render that shows it, until it ends. */
  const turnAbort = atom<AbortController | undefined>(undefined);
  const selection = atom(initialSelection);

  /** Includes the command or subagent the turn waits for, as `foreground`. */
  const tasks = atom<BackgroundTask[]>([]);
  const unread = atom<Steered[]>([]);

  return {
    state,
    /** Written only by the session, which stamps each action once and tells whoever follows it. */
    dispatch: atom(null, (get, set, { action, at }: StampedAction) => set(state, reduce(get(state), action, at))),
    entries,
    title: atom((get) => get(state).title),
    todos: atom((get) => get(state).todos),
    worktree: atom((get) => get(state).worktree),
    wantsWorktree: atom(worktree),
    busySince,
    busy,
    editTurns: atom((get) => editTurns(get(entries))),
    turnAbort,
    working: atom((get) => get(busy) || get(turnAbort) !== undefined),
    queue: atom<Submission[]>([]),
    /** Steered into the running turn and not read by the agent yet; each joins the conversation once it is. */
    unread,
    /** What a client shows of them, above the prompt. */
    steering: atom((get) => get(unread).map(({ text }) => text)),
    agent,
    features: atom(features),
    selection,
    modelName: atom((get) => modelName(get(selection), get(models))),
    modelLabel: atom((get) => modelLabel(get(selection), get(models))),
    mode: atom(mode),
    tasks,
    backgroundTasks: atom((get) => get(tasks).filter((task) => !task.foreground)),
    waitsOnForegroundTask: atom((get) => get(tasks).some((task) => task.foreground && task.status === 'running')),
    /** What the session waits for the user to answer, such as a permission; a client shows the active session's. */
    dialog: atom<Dialog | undefined>(undefined),
  };
}

export type SessionAtoms = ReturnType<typeof sessionAtoms>;
