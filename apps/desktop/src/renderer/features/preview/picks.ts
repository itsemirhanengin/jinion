import type { PreviewPick } from '../../../main/bridge.js';
import type { Core } from '../../core/core.js';
import { draftsAtom } from '../../state/app.js';
import { draftPicksAtom } from '../../state/previews.js';
import { uniqueName } from '../threads/draft.js';
import { pickName } from './pick-prompt.js';

/** A pick in the composer of the thread in sight, as a chip at the end of what is typed there. */
export function addPick(core: Core, pick: PreviewPick) {
  const { store } = core.client;
  const session = store.get(core.client.shownAtom);
  if (!session) return store.set(core.problemAtom, 'Open a thread to send it what you pick on the page.');

  const picks = store.get(draftPicksAtom)[session] ?? [];
  const name = uniqueName(pickName(pick, picks), picks.map((each) => each.name));

  store.set(draftPicksAtom, (all) => ({ ...all, [session]: [...(all[session] ?? []), { name, pick }] }));

  store.set(draftsAtom, (all) => {
    const typed = all[session] ?? '';
    const gap = typed && !/\s$/.test(typed) ? ' ' : '';

    return { ...all, [session]: `${typed}${gap}${name} ` };
  });
}
