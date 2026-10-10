import { emptyLayout, Workbench, type WorkbenchState } from '@jinion/workbench';
import type { Core } from '../core/core.js';
import { featuresOf } from '../features/features.js';
import { followPreviews } from '../features/preview/previews.js';
import { followAgentTerminals } from '../features/terminal/terminal.js';
import { saveWorkbench, savedWorkbench } from '../state/saved.js';

const cards = { open: true, size: 288, view: 'cards' };

/** A project's window the first time: Agent with the threads and the cards, Code with the files and a terminal under the editor. */
const fresh: WorkbenchState = {
  mode: 'agent',
  layouts: {
    agent: { ...emptyLayout, activity: 'threads', lastActivity: 'threads', right: cards, bottom: { open: false, size: 240, view: 'terminal' } },
    code: { ...emptyLayout, activity: 'files', lastActivity: 'files', right: cards, bottom: { open: true, size: 220, view: 'terminal' } },
  },
};

const workbenches = new Map<string, Workbench>();

/** The project's window, made once and kept, so its modes, tabs and panels stay as they were left, across launches too. */
export function workbenchOf(core: Core) {
  const { path } = core.project;
  let workbench = workbenches.get(path);

  if (!workbench) {
    const saved = savedWorkbench(path);
    const mode = saved?.mode && saved.mode in fresh.layouts ? saved.mode : fresh.mode;
    const made = new Workbench(featuresOf(core), { mode, layouts: { ...fresh.layouts, ...saved?.layouts } });

    made.subscribe(() => saveWorkbench(path, made.getState()));
    followAgentTerminals(core, made);
    followPreviews(core, made);
    workbenches.set(path, made);
    workbench = made;
  }

  return workbench;
}
