import { branchBase, findRepos, repoChanges, repoState, type FileChange, type Repo } from './repos.js';

export interface RepoChanges {
  repo: Repo;
  branch?: string;
  changes: FileChange[];
  /** With nothing uncommitted, what the branch adds on top of the default branch. */
  since?: { base: string; against: string };
}

/** What `/diff` shows as Current, for every repository in `cwd` or in the folders below it. */
export const readChanges = (cwd: string) => Promise.all(findRepos(cwd).map(readRepo));

async function readRepo(repo: Repo): Promise<RepoChanges> {
  const [state, changes] = await Promise.all([repoState(repo), repoChanges(repo).catch(() => [])]);
  if (changes.length > 0) return { repo, branch: state?.branch, changes };

  const since = await branchBase(repo).catch(() => undefined);
  if (!since) return { repo, branch: state?.branch, changes };

  return { repo, branch: state?.branch, changes: await repoChanges(repo, since.base).catch(() => []), since };
}
