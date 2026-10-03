import { useAtomValue } from 'jotai';
import { useJinion } from '../app/context.js';
import { worktreeAtom } from '../state/session.js';

/** Where the conversation works: its worktree, or the project. */
export function useWorkdir() {
  const { info } = useJinion();

  return useAtomValue(worktreeAtom)?.folder ?? info.cwd;
}
