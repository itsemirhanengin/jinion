import type { Feature } from '@jinion/workbench';
import { GitBranch } from 'lucide-react';
import { GitDiffs } from './diffs.js';
import { GitSidebar } from './sidebar.js';

export const GIT_TAB = { kind: 'git', id: 'changes' };

/** The repositories as git sees them: what to stage and commit in the sidebar, every diff in a tab beside it. */
export function git(): Feature {
  return {
    id: 'git',
    activity: { title: 'Git', icon: <GitBranch />, mode: 'code', Sidebar: GitSidebar, page: GIT_TAB },
    tabs: [{ kind: 'git', Title: () => 'Git', Content: GitDiffs }],
  };
}
