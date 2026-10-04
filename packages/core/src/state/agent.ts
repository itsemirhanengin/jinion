import type { ModelOption } from '../agent/models.js';
import { atom } from 'jotai/vanilla';
import { atomWithLazy } from 'jotai/vanilla/utils';
import type { AgentAccount } from '../agent/accounts.js';
import type { AgentCommand } from '../agent/agent.js';
import type { SeenLimits } from '../agent/usage.js';
import { loadLimits, updateLimits } from '../settings/limits.js';
import { skillMention } from '../prompt/skills.js';

export const modelsAtom = atom<ModelOption[] | undefined>(undefined);

export const accountAtom = atom<string | undefined>(undefined);

export const identityAtom = atom<AgentAccount | undefined>(undefined);

const storedLimits = atomWithLazy(loadLimits);

/** A change applies to the limits on disk, so the accounts another Jinion has seen since stay. */
export const seenLimitsAtom = atom(
  (get) => get(storedLimits),
  (_get, set, change: (seen: SeenLimits) => SeenLimits) => set(storedLimits, updateLimits(change)),
);

export const skillsAtom = atom<AgentCommand[]>([]);

export const mentionAtom = atom((get) => skillMention(get(skillsAtom)));
