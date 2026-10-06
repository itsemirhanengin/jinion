import type { Workbench } from '@jinion/workbench';
import type { Core } from '../../core/core.js';
import type { DraftComment } from '../../state/comments.js';
import { reveal } from '../../state/reveal.js';
import { openChanges } from '../changes/changes.js';
import { GIT_TAB } from '../git/git.js';

/** The tab the comment was left in, scrolled to its file. */
export function openComment(core: Core, workbench: Workbench, session: string, comment: DraftComment) {
  if (comment.tab === 'changes') return openChanges(core, workbench, session, comment.path);

  workbench.open(GIT_TAB);
  reveal(core, 'git:changes', comment.path);
}
