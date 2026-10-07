import { keyOf, type Workbench } from '@jinion/workbench';
import type { Core } from '../../core/core.js';
import { previewStatesAtom, previewUrlsAtom } from '../../state/previews.js';
import { savedPreviews, savePreviews } from '../../state/saved.js';
import { openBesideThread } from '../beside.js';
import { addPick } from './picks.js';

/** The one preview a project has for now. */
export const PREVIEW = { kind: 'preview', id: 'page' };

const THREAD_SHARE = 0.5;

const cores = new Map<string, Core>();

/** The previews loaded in this run, so one that comes back with the layout loads its address once. */
const loaded = new Set<string>();

/** Every project's previews share the window, so the main process knows each by its project too. */
export const bridgeKey = (core: Core, id: string) => `${core.project.path}|${id}`;

/** The project's preview addresses as they were left, kept as they change, and what the main process says of them. */
export function followPreviews(core: Core) {
  const { store } = core.client;

  if (cores.size === 0) listen();
  cores.set(core.project.path, core);
  store.set(previewUrlsAtom, savedPreviews(core.project.path));
  store.sub(previewUrlsAtom, () => savePreviews(core.project.path, store.get(previewUrlsAtom)));
}

/** The preview beside the thread, half the room each; brought to the front when it is open already. */
export function openPreview(core: Core, workbench: Workbench) {
  const open = workbench.getLayout().groups.some((group) => group.tabs.some((tab) => keyOf(tab) === keyOf(PREVIEW)));

  if (open) workbench.open(PREVIEW);
  else openBesideThread(workbench, PREVIEW, core.client.store.get(core.client.shownAtom), THREAD_SHARE);
}

/** What the user typed, as an address: `localhost:5173` is taken for `http://localhost:5173`. */
export function loadPreview(core: Core, id: string, typed: string) {
  const text = typed.trim();
  if (!text) return;

  const url = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;

  core.client.store.set(previewUrlsAtom, (all) => ({ ...all, [id]: url }));
  loaded.add(bridgeKey(core, id));
  window.desktop.preview.load(bridgeKey(core, id), url);
}

/** Loads the saved address the first time the preview shows in this run. */
export function loadOnce(core: Core, id: string, url: string) {
  const key = bridgeKey(core, id);

  if (loaded.has(key)) return;

  loaded.add(key);
  window.desktop.preview.load(key, url);
}

export function closePreview(core: Core, id: string) {
  const { store } = core.client;
  const key = bridgeKey(core, id);

  loaded.delete(key);
  window.desktop.preview.close(key);
  store.set(previewUrlsAtom, ({ [id]: _, ...rest }) => rest);
  store.set(previewStatesAtom, ({ [id]: _, ...rest }) => rest);
}

export function togglePoint(core: Core, id: string) {
  const pointing = core.client.store.get(previewStatesAtom)[id]?.pointing ?? false;

  window.desktop.preview.point(bridgeKey(core, id), !pointing);
}

function listen() {
  window.desktop.preview.onState((key, state) => {
    const found = previewOf(key);

    found?.core.client.store.set(previewStatesAtom, (all) => ({ ...all, [found.id]: state }));
  });

  window.desktop.preview.onPick((key, pick) => {
    const found = previewOf(key);

    if (found) addPick(found.core, pick);
  });
}

function previewOf(key: string) {
  const at = key.lastIndexOf('|');
  const core = cores.get(key.slice(0, at));

  return core && { core, id: key.slice(at + 1) };
}
