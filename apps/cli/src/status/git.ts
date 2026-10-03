import { useEffect, useState } from 'react';
import { findRepos, repoState, type Repo, type RepoState } from '../git/repos.js';

/** Every repository the project works in, with its branch and changes. */
export interface GitStatus {
  repos: (RepoState & { repo: Repo })[];
}

/**
 * Runs `git status` in the background whenever `refresh` changes, in the project's repository or, for a folder that
 * holds several, in each of them. `undefined` when there is none.
 */
export function useGitStatus(cwd: string, enabled: boolean, refresh: unknown) {
  const [status, setStatus] = useState<GitStatus>();

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void Promise.all(
      findRepos(cwd).map(async (repo) => {
        const state = await repoState(repo);
        return state ? [{ ...state, repo }] : [];
      }),
    ).then((found) => {
      const repos = found.flat();
      if (current) setStatus(repos.length > 0 ? { repos } : undefined);
    });
    return () => {
      current = false;
    };
  }, [cwd, enabled, refresh]);

  return enabled ? status : undefined;
}
