import { atom, type Getter } from 'jotai';
import { modelLabel, modelName } from '@jinion/core/agent/models';
import type { JinionClient } from '@jinion/core/api/client';
import { editTurns } from '@jinion/core/conversation/edits';
import { skillMention } from '@jinion/core/prompt/skills';

/** Set once as the app starts; everything below reads the client's store through it. */
export const clientAtom = atom<JinionClient | undefined>(undefined);

function client(get: Getter) {
  const found = get(clientAtom);
  if (!found) throw new Error('The app has no client yet.');

  return found;
}

/** The session the app shows: the active one, once the client holds it. */
export const shownAtom = atom((get) => {
  const following = client(get);
  const id = get(following.shownAtom);
  const snapshot = id === undefined ? undefined : get(following.session(id));
  if (id === undefined || !snapshot) throw new Error('No session is shown yet.');

  return { id, ...snapshot };
});

export const sessionAtom = atom((get) => get(shownAtom).state);

export const entriesAtom = atom((get) => get(sessionAtom).entries);

export const todosAtom = atom((get) => get(sessionAtom).todos);

export const worktreeAtom = atom((get) => get(sessionAtom).worktree);

export const busySinceAtom = atom((get) => get(sessionAtom).busySince);

export const busyAtom = atom((get) => get(busySinceAtom) !== undefined);

export const editTurnsAtom = atom((get) => editTurns(get(entriesAtom)));

const fields = (get: Getter) => get(shownAtom).fields;

/** From the moment a turn starts until it ends, also before its first event. */
export const workingAtom = atom((get) => fields(get).working);

export const queueAtom = atom((get) => fields(get).queue);

export const selectionAtom = atom((get) => fields(get).selection);

export const modeAtom = atom((get) => fields(get).mode);

/** Includes the command or subagent the turn waits for, as `foreground`. */
export const tasksAtom = atom((get) => fields(get).tasks);

export const backgroundTasksAtom = atom((get) => get(tasksAtom).filter((task) => !task.foreground));

export const waitsOnForegroundTaskAtom = atom((get) => get(tasksAtom).some((task) => task.foreground && task.status === 'running'));

export const dialogAtom = atom((get) => fields(get).dialog);

function app(get: Getter) {
  const found = get(client(get).appAtom);
  if (!found) throw new Error('The client is not initialized yet.');

  return found;
}

export const modelsAtom = atom((get) => app(get).models);

export const accountAtom = atom((get) => app(get).account);

export const identityAtom = atom((get) => app(get).identity);

export const skillsAtom = atom((get) => app(get).skills);

export const seenLimitsAtom = atom((get) => app(get).seenLimits);

/** The default for new sessions, which `ctrl+g` turns on and off. */
export const worktreesAtom = atom((get) => app(get).worktrees);

export const mentionAtom = atom((get) => skillMention(get(skillsAtom)));

export const modelNameAtom = atom((get) => modelName(get(selectionAtom), get(modelsAtom)));

export const modelLabelAtom = atom((get) => modelLabel(get(selectionAtom), get(modelsAtom)));
