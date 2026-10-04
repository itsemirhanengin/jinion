import type { ModelOption } from '../agent/models.js';
import { atom } from 'jotai/vanilla';
import type { AgentAccount } from '../agent/accounts.js';
import type { AgentCommand } from '../agent/agent.js';
import { loadLimits, saveLimits } from '../settings/limits.js';
import { skillMention } from '../prompt/skills.js';
import { persistedAtom } from '../lib/persisted.js';

export const modelsAtom = atom<ModelOption[] | undefined>(undefined);

export const accountAtom = atom<string | undefined>(undefined);

export const identityAtom = atom<AgentAccount | undefined>(undefined);

export const seenLimitsAtom = persistedAtom(loadLimits, saveLimits);

export const skillsAtom = atom<AgentCommand[]>([]);

export const mentionAtom = atom((get) => skillMention(get(skillsAtom)));
