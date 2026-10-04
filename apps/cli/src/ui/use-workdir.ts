import { useAtomValue } from 'jotai';
import { useApi } from '../app/api.js';
import { worktreeAtom } from '../state/session.js';

/** Where the conversation works: its worktree, or the project. */
export function useWorkdir() {
  const { initialized } = useApi();

  return useAtomValue(worktreeAtom)?.folder ?? initialized.info.cwd;
}
