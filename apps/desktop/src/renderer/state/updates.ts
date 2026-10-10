import { atom } from 'jotai';
import { appStore } from './app.js';

/** The newer version downloaded and waiting for a restart, once there is one; in the app's store. */
export const updateAtom = atom<string | undefined>(undefined);

// One may have come down before the page loaded, as after a reload.
void window.desktop.updateReady().then((version) => appStore.set(updateAtom, version));
window.desktop.onUpdateReady((version) => appStore.set(updateAtom, version));
