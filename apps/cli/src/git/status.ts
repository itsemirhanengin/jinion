import { findRepos, repoState, type Repo, type RepoState } from './repos.js';

export interface GitStatus {
  repos: (RepoState & { repo: Repo })[];
}

/** Every repository in `cwd` or in the folders below it; `undefined` when there is none. */
export async function readGitStatus(cwd: string): Promise<GitStatus | undefined> {
  const found = await Promise.all(
    findRepos(cwd).map(async (repo) => {
      const state = await repoState(repo);

      return state ? [{ ...state, repo }] : [];
    }),
  );

  const repos = found.flat();

  return repos.length > 0 ? { repos } : undefined;
}
