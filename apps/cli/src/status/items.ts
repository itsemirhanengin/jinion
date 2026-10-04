import { atom } from 'jotai';
import { persistedAtom } from '@jinion/core/lib/persisted';
import { DEFAULT_STATUS_LINE, knownItems } from './line.js';
import { loadStatusLine, saveStatusLine, type StatusItem } from './saved.js';

export const statusItemsAtom = persistedAtom(() => knownItems(loadStatusLine() ?? DEFAULT_STATUS_LINE), saveStatusLine);

export const statusPreviewAtom = atom<StatusItem[] | undefined>(undefined);

export const shownStatusItemsAtom = atom((get) => get(statusPreviewAtom) ?? get(statusItemsAtom));
