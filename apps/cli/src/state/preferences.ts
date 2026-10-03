import { atom } from 'jotai';
import { loadSettings, saveNotifications, saveStatusLine } from '../settings/user.js';
import { DEFAULT_STATUS_LINE, knownItems, type StatusItem } from '../status/line.js';
import { persistedAtom } from './persisted.js';

export const notificationsAtom = persistedAtom(() => loadSettings().notifications !== false, saveNotifications);

export const statusItemsAtom = persistedAtom(() => knownItems(loadSettings().statusLine ?? DEFAULT_STATUS_LINE), saveStatusLine);

export const statusPreviewAtom = atom<StatusItem[] | undefined>(undefined);

export const shownStatusItemsAtom = atom((get) => get(statusPreviewAtom) ?? get(statusItemsAtom));
