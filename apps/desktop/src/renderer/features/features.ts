import type { Feature } from '@jinion/workbench';
import type { Core } from '../core/core.js';
import { changes } from './changes/changes.js';
import { files } from './files/files.js';
import { git } from './git/git.js';
import { pagesFeature } from './pages.js';
import { search } from './search.js';
import { tasks } from './tasks.js';
import { threads } from './threads/threads.js';
import { tools } from './tools.js';

/** Everything a project's window has, in the order of the activity bar; a new feature is a new entry here. */
export function featuresOf(core: Core): Feature[] {
  return [threads(core), search(), git(), changes(), files(), ...pagesFeature(), tools(), tasks()];
}
