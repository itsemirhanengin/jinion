import { atom, type Getter } from 'jotai';
import type { AgentCommand } from '@jinion/core/agent/agent';
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

export interface Tab {
  id: string;
  title?: string;
  working: boolean;
  /** A question, permission or plan waits on the user. */
  waiting: boolean;
  shown: boolean;
}

/** Every open session, in the order they opened; the client follows them all. */
export const tabsAtom = atom((get): Tab[] => {
  const following = client(get);
  const shown = get(following.shownAtom);

  return get(following.sessionsAtom).sessions.map(({ id, title, working }) => ({
    id,
    title,
    working,
    waiting: get(following.session(id))?.fields.dialog !== undefined,
    shown: id === shown,
  }));
});

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

/** Steered into the running turn; each joins the conversation once the agent reads it. */
export const steeringAtom = atom((get) => fields(get).steering ?? []);

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

/** The backend the shown session runs on, with what it and the session on it can do. */
export const agentAtom = atom((get) => {
  const { agent: name, features } = fields(get);
  const info = app(get).agents.find((candidate) => candidate.name === name);
  if (!info) throw new Error(`The server didn't describe ${name}.`);

  return { ...info, features: { ...info.features, ...features } };
});

export const agentsAtom = atom((get) => app(get).agents);

/** Every backend's models, by backend; one is missing until it has listed them. */
export const allModelsAtom = atom((get) => app(get).models);

export const modelsAtom = atom((get) => app(get).models[get(agentAtom).name]);

export const accountAtom = atom((get) => app(get).accounts[get(agentAtom).name]);

export const identityAtom = atom((get) => app(get).identities[get(agentAtom).name]);

const noSkills: AgentCommand[] = [];

export const skillsAtom = atom((get) => app(get).skills[get(agentAtom).name] ?? noSkills);

export const seenLimitsAtom = atom((get) => app(get).seenLimits);

/** The default for new sessions, which `ctrl+g` turns on and off. */
export const worktreesAtom = atom((get) => app(get).worktrees);

export const mentionAtom = atom((get) => skillMention(get(skillsAtom)));

export const modelNameAtom = atom((get) => modelName(get(selectionAtom), get(modelsAtom)));

export const modelLabelAtom = atom((get) => modelLabel(get(selectionAtom), get(modelsAtom)));
