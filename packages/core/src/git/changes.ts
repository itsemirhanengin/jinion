import { branchBase, findRepos, repoChanges, repoState } from './repos.js';
import type { Repo, RepoChanges } from './types.js';

/**
 * What `/diff` shows as Current, for every repository in `cwd` or in the folders below it; `uncommitted` keeps to what
 * isn't committed yet, never the branch's own commits.
 */
export const readChanges = (cwd: string, uncommitted = false) => Promise.all(findRepos(cwd).map((repo) => readRepo(repo, uncommitted)));

async function readRepo(repo: Repo, uncommitted: boolean): Promise<RepoChanges> {
  const [state, changes] = await Promise.all([repoState(repo), repoChanges(repo).catch(() => [])]);
  if (changes.length > 0 || uncommitted) return { repo, branch: state?.branch, changes };

  const since = await branchBase(repo).catch(() => undefined);
  if (!since) return { repo, branch: state?.branch, changes };

  return { repo, branch: state?.branch, changes: await repoChanges(repo, since.base).catch(() => []), since };
}
