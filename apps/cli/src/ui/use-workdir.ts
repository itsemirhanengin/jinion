import { worktreeAtom } from '@jinion/core/state/active';
import { useAtomValue } from 'jotai';
import { useJinion } from '../app/context.js';

/** Where the conversation works: its worktree, or the project. */
export function useWorkdir() {
  const { info } = useJinion();

  return useAtomValue(worktreeAtom)?.folder ?? info.cwd;
}
