import type { ModelOption, ModelSelection } from '../agent/models.js';
import { atom } from 'jotai/vanilla';
import type { AgentAccount } from '../agent/accounts.js';
import type { AgentCommand, AgentMode } from '../agent/agent.js';
import type { BackgroundTask } from '../agent/tasks.js';
import { loadLimits, saveLimits } from '../settings/limits.js';
import { skillMention } from '../prompt/skills.js';
import { persistedAtom } from './persisted.js';

export const selectionAtom = atom<ModelSelection>({ model: '' });

export const modelsAtom = atom<ModelOption[] | undefined>(undefined);

export const modelNameAtom = atom((get) => {
  const { model } = get(selectionAtom);

  return get(modelsAtom)?.find((option) => option.id === model)?.name ?? model;
});

export const modelLabelAtom = atom((get) => {
  const { effort } = get(selectionAtom);

  return effort ? `${get(modelNameAtom)} · ${effort}` : get(modelNameAtom);
});

export const modeAtom = atom<AgentMode>('edits');

export const accountAtom = atom<string | undefined>(undefined);

export const identityAtom = atom<AgentAccount | undefined>(undefined);

export const seenLimitsAtom = persistedAtom(loadLimits, saveLimits);

export const skillsAtom = atom<AgentCommand[]>([]);

export const mentionAtom = atom((get) => skillMention(get(skillsAtom)));

/** Includes the command or subagent the turn waits for, as `foreground`. */
export const tasksAtom = atom<BackgroundTask[]>([]);

export const backgroundTasksAtom = atom((get) => get(tasksAtom).filter((task) => !task.foreground));

export const waitsOnForegroundTaskAtom = atom((get) =>
  get(tasksAtom).some((task) => task.foreground && task.status === 'running'),
);
