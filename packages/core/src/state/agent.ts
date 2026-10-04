import type { ModelOption } from '../agent/models.js';
import { atom } from 'jotai/vanilla';
import { atomWithLazy } from 'jotai/vanilla/utils';
import type { AgentAccount } from '../agent/accounts.js';
import type { AgentCommand, AgentInfo } from '../agent/agent.js';
import type { SeenLimits } from '../agent/usage.js';
import { loadLimits, updateLimits } from '../settings/limits.js';

/** The backends, in the order `/model` lists them. */
export const agentsAtom = atom<AgentInfo[]>([]);

/** By backend; one is missing until it has listed its models. */
export const modelsAtom = atom<Record<string, ModelOption[]>>({});

/** The account each backend uses, by backend. */
export const accountsAtom = atom<Record<string, string>>({});

/** Who is signed in to each backend, by backend. */
export const identitiesAtom = atom<Record<string, AgentAccount>>({});

const storedLimits = atomWithLazy(loadLimits);

/** A change applies to the limits on disk, so the accounts another Jinion has seen since stay. */
export const seenLimitsAtom = atom(
  (get) => get(storedLimits),
  (_get, set, change: (seen: SeenLimits) => SeenLimits) => set(storedLimits, updateLimits(change)),
);

/** By backend. */
export const skillsAtom = atom<Record<string, AgentCommand[]>>({});
