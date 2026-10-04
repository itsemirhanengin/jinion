import { atom } from 'jotai';
import { loadSettings, saveStatusLine, type StatusItem } from '../settings/user.js';
import { persistedAtom } from '../state/persisted.js';
import { DEFAULT_STATUS_LINE, knownItems } from './line.js';

export const statusItemsAtom = persistedAtom(() => knownItems(loadSettings().statusLine ?? DEFAULT_STATUS_LINE), saveStatusLine);

export const statusPreviewAtom = atom<StatusItem[] | undefined>(undefined);

export const shownStatusItemsAtom = atom((get) => get(statusPreviewAtom) ?? get(statusItemsAtom));
