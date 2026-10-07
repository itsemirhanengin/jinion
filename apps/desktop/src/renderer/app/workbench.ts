import { emptyLayout, Workbench } from '@jinion/workbench';
import type { Core } from '../core/core.js';
import { featuresOf } from '../features/features.js';
import { followPreviews } from '../features/preview/previews.js';
import { followAgentTerminals } from '../features/terminal/terminal.js';
import { saveLayout, savedLayout } from '../state/saved.js';

const workbenches = new Map<string, Workbench>();

/** The project's window, made once and kept, so its tabs and panels stay as they were left, across launches too. */
export function workbenchOf(core: Core) {
  const { path } = core.project;
  let workbench = workbenches.get(path);

  if (!workbench) {
    const made = new Workbench(
      featuresOf(core),
      savedLayout(path) ?? {
        ...emptyLayout,
        activity: 'threads',
        lastActivity: 'threads',
        right: { open: true, size: 224, view: 'tools' },
        bottom: { open: false, size: 240, view: 'tasks' },
      },
    );

    made.subscribe(() => saveLayout(path, made.getLayout()));
    followAgentTerminals(core, made);
    followPreviews(core);
    workbenches.set(path, made);
    workbench = made;
  }

  return workbench;
}
