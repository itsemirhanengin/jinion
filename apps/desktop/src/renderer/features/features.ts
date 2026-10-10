import type { Feature } from '@jinion/workbench';
import type { Core } from '../core/core.js';
import { cards } from './cards.js';
import { changes } from './changes/changes.js';
import { files } from './files/files.js';
import { git } from './git/git.js';
import { pages } from './pages.js';
import { plan } from './plan/plan.js';
import { preview } from './preview/preview.js';
import { quickOpen } from './quick-open.js';
import { search } from './search.js';
import { tasks } from './tasks.js';
import { terminal } from './terminal/terminal.js';
import { threads } from './threads/threads.js';

/** Everything a project's window has, the sidebar's views in the order of its row; a new feature is a new entry here. */
export function featuresOf(core: Core): Feature[] {
  return [threads(core), files(core), search(), git(), changes(), plan(), preview(core), pages(), quickOpen(), cards(), tasks(), terminal(core)];
}
