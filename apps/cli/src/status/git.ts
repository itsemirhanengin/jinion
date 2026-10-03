import { useEffect, useState } from 'react';
import { findRepos, repoState, type Repo, type RepoState } from '../git/repos.js';

export interface GitStatus {
  repos: (RepoState & { repo: Repo })[];
}

async function readGitStatus(cwd: string): Promise<GitStatus | undefined> {
  const found = await Promise.all(
    findRepos(cwd).map(async (repo) => {
      const state = await repoState(repo);
      return state ? [{ ...state, repo }] : [];
    }),
  );
  const repos = found.flat();
  return repos.length > 0 ? { repos } : undefined;
}

/** The last status stays shown while it is read again. */
export function useGitStatus(cwd: string, enabled: boolean, refresh: unknown) {
  const [status, setStatus] = useState<GitStatus>();

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void readGitStatus(cwd).then((found) => current && setStatus(found));
    return () => {
      current = false;
    };
  }, [cwd, enabled, refresh]);

  return enabled ? status : undefined;
}
