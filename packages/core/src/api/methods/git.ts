import { readFile, realpath, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { readChanges } from '../../git/changes.js';
import { fileDiff, findRepos } from '../../git/repos.js';
import { commit, stage, unstage } from '../../git/staging.js';
import { readGitStatus } from '../../git/status.js';
import type { Repo, RepoChanges } from '../../git/types.js';
import { listProjectFiles } from '../../prompt/files.js';
import type { Methods } from '../connection.js';
import { ApiCode } from '../protocol.js';
import { RpcError } from '../rpc.js';

/** The files and git state of the folder a session works in. */
export const gitMethods: Methods = (connection) => {
  // A diff is only of a file these named, so a client can't have any path on the machine read.
  const lastChanges = new Map<string, RepoChanges[]>();

  const changes = async (session: string, uncommitted?: boolean) => {
    const read = await readChanges(connection.find(session).folder, uncommitted);

    lastChanges.set(session, read);

    return read;
  };

  // Each repository gets its own `git add` or `git restore`, with the paths in it.
  const inRepos = async (session: string, files: string[], change: (repo: Repo, paths: string[]) => Promise<void>) => {
    const repos = lastChanges.get(session) ?? (await changes(session, true));
    const unknown = files.find((file) => !repos.some(({ changes }) => changes.some((each) => each.absolute === file)));
    if (unknown) throw new RpcError(ApiCode.unknownFile, `${unknown} has no changes in this session's folder.`);

    for (const { repo, changes } of repos) {
      const paths = changes.filter((each) => files.includes(each.absolute)).map((each) => each.file);

      if (paths.length > 0) await change(repo, paths);
    }
  };

  connection.answer('git/status', async ({ session }) => (await readGitStatus(connection.find(session).folder)) ?? null);
  connection.answer('git/changes', ({ session, uncommitted }) => changes(session, uncommitted));
  connection.answer('git/stage', ({ session, files }) => inRepos(session, files, stage).then(() => null));
  connection.answer('git/unstage', ({ session, files }) => inRepos(session, files, unstage).then(() => null));

  connection.answer('git/commit', async ({ session, repo: root, message }) => {
    const repo = findRepos(connection.find(session).folder).find((each) => each.root === root);
    if (!repo) throw new RpcError(ApiCode.unknownFile, `${root} isn't a repository in this session's folder.`);

    return { commit: await commit(repo, message) };
  });

  connection.answer('git/diff', async ({ session, file }) => {
    const repos = lastChanges.get(session) ?? (await changes(session));
    const repo = repos.find(({ changes }) => changes.some((change) => change.absolute === file));
    const change = repo?.changes.find((candidate) => candidate.absolute === file);
    if (!repo || !change) throw new RpcError(ApiCode.unknownFile, `${file} has no changes in this session's folder.`);

    return fileDiff(repo.repo, change, repo.since?.base);
  });

  connection.answer('files/list', ({ session }) => listProjectFiles(connection.find(session).folder));
  connection.answer('files/read', ({ session, path }) => readInFolder(connection.find(session).folder, path));
};

const MAX_READ_BYTES = 2 * 1024 * 1024;

// Real paths on both sides, so neither `..` nor a link pointing out of the folder reaches a file beyond it.
async function readInFolder(folder: string, path: string) {
  const [root, file] = await Promise.all([realpath(folder), realpath(resolve(folder, path)).catch(() => undefined)]);
  const inside = file !== undefined && !relative(root, file).startsWith('..') && !isAbsolute(relative(root, file));
  const info = inside ? await stat(file) : undefined;
  if (!file || !info?.isFile()) throw new RpcError(ApiCode.unknownFile, `${path} isn't a file in this session's folder.`);
  if (info.size > MAX_READ_BYTES) throw new RpcError(ApiCode.unsupported, `${path} is too large to show here.`);

  return readFile(file, 'utf8');
}
