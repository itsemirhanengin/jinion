import { atom } from 'jotai/vanilla';
import type { AgentMode } from '../agent/agent.js';
import type { ModelSelection } from '../agent/models.js';
import type { BackgroundTask } from '../agent/tasks.js';
import { editTurns } from '../conversation/edits.js';
import { reduce, type Action } from '../conversation/reducer.js';
import type { SessionState } from '../conversation/session.js';
import { modelsAtom } from './agent.js';

export const DEFAULT_CONTEXT_WINDOW = 200_000;

export interface SessionStart {
  state: SessionState;
  selection: ModelSelection;
  mode: AgentMode;
}

/** One session's atoms, in the app's one store. Its controllers read and write these only, never another session's. */
export function sessionAtoms({ state: initial, selection: initialSelection, mode }: SessionStart) {
  const state = atom(initial);
  const entries = atom((get) => get(state).entries);
  const busySince = atom((get) => get(state).busySince);
  const busy = atom((get) => get(busySince) !== undefined);
  /** Set from the moment a turn starts, before the render that shows it, until it ends. */
  const turnAbort = atom<AbortController | undefined>(undefined);
  const selection = atom(initialSelection);

  const modelName = atom((get) => {
    const { model } = get(selection);

    return get(modelsAtom)?.find((option) => option.id === model)?.name ?? model;
  });

  /** Includes the command or subagent the turn waits for, as `foreground`. */
  const tasks = atom<BackgroundTask[]>([]);

  return {
    state,
    dispatch: atom(null, (get, set, action: Action) => set(state, reduce(get(state), action))),
    entries,
    todos: atom((get) => get(state).todos),
    worktree: atom((get) => get(state).worktree),
    busySince,
    busy,
    editTurns: atom((get) => editTurns(get(entries))),
    turnAbort,
    working: atom((get) => get(busy) || get(turnAbort) !== undefined),
    draft: atom(''),
    queue: atom<string[]>([]),
    selection,
    modelName,
    modelLabel: atom((get) => {
      const { effort } = get(selection);

      return effort ? `${get(modelName)} · ${effort}` : get(modelName);
    }),
    mode: atom(mode),
    tasks,
    backgroundTasks: atom((get) => get(tasks).filter((task) => !task.foreground)),
    waitsOnForegroundTask: atom((get) => get(tasks).some((task) => task.foreground && task.status === 'running')),
  };
}

export type SessionAtoms = ReturnType<typeof sessionAtoms>;
