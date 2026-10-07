import type { Workbench } from '@jinion/workbench';
import type { Core } from '../../core/core.js';
import { previewStatesAtom, previewUrlsAtom } from '../../state/previews.js';
import { savedPreviews, savePreviews } from '../../state/saved.js';
import { openBesideThread } from '../beside.js';
import { addPick } from './picks.js';

export const PREVIEW = 'preview';

const THREAD_SHARE = 0.5;

const cores = new Map<string, Core>();

/** The previews loaded in this run, so one that comes back with the layout loads its address once. */
const loaded = new Set<string>();

/** Every project's previews share the window, so the main process knows each by its project too. */
export const bridgeKey = (core: Core, id: string) => `${core.project.path}|${id}`;

/**
 * The addresses of the previews that came back with the layout, kept as they change, and what the main process says
 * of them; a preview closed in an earlier run is forgotten.
 */
export function followPreviews(core: Core, workbench: Workbench) {
  const { store } = core.client;
  const open = new Set(previewTabs(workbench).map((tab) => tab.id));
  const saved = Object.entries(savedPreviews(core.project.path)).filter(([id]) => open.has(id));

  if (cores.size === 0) listen();
  cores.set(core.project.path, core);
  store.set(previewUrlsAtom, Object.fromEntries(saved));
  store.sub(previewUrlsAtom, () => savePreviews(core.project.path, store.get(previewUrlsAtom)));
}

/** A new, empty preview: with the other previews when there are some, beside the thread otherwise, half the room each. */
export function openPreview(core: Core, workbench: Workbench) {
  const tab = { kind: PREVIEW, id: Math.random().toString(36).slice(2, 10) };
  const group = workbench.getLayout().groups.findIndex((each) => each.tabs.some((other) => other.kind === PREVIEW));

  if (group === -1) openBesideThread(workbench, tab, core.client.store.get(core.client.shownAtom), THREAD_SHARE);
  else workbench.open(tab, { group });
}

export function previewTabs(workbench: Workbench) {
  return workbench.getLayout().groups.flatMap((group) => group.tabs.filter((tab) => tab.kind === PREVIEW));
}

/** The preview in sight: the focused group's, or another group's. */
export function shownPreview(workbench: Workbench) {
  const { groups, focused } = workbench.getLayout();
  const key = [groups[focused], ...groups].map((group) => group?.active).find((active) => active?.startsWith(`${PREVIEW}:`));

  return key?.slice(PREVIEW.length + 1);
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
