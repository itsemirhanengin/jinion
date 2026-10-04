import { atom } from 'jotai';
import { loadSettings, saveStatusLine, type StatusItem } from '@jinion/core/settings/user';
import { persistedAtom } from '@jinion/core/state/persisted';
import { DEFAULT_STATUS_LINE, knownItems } from './line.js';

export const statusItemsAtom = persistedAtom(() => knownItems(loadSettings().statusLine ?? DEFAULT_STATUS_LINE), saveStatusLine);

export const statusPreviewAtom = atom<StatusItem[] | undefined>(undefined);

export const shownStatusItemsAtom = atom((get) => get(statusPreviewAtom) ?? get(statusItemsAtom));
