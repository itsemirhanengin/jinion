import { readChanges, type RepoChanges } from '../../git/changes.js';
import { fileDiff } from '../../git/repos.js';
import { readGitStatus } from '../../git/status.js';
import { listProjectFiles } from '../../prompt/files.js';
import type { Methods } from '../connection.js';
import { ApiCode } from '../protocol.js';
import { RpcError } from '../rpc.js';

/** The files and git state of the folder a session works in. */
export const gitMethods: Methods = (connection) => {
  // A diff is only of a file these named, so a client can't have any path on the machine read.
  const lastChanges = new Map<string, RepoChanges[]>();

  const changes = async (session: string) => {
    const read = await readChanges(connection.find(session).folder);

    lastChanges.set(session, read);

    return read;
  };

  connection.answer('git/status', async ({ session }) => (await readGitStatus(connection.find(session).folder)) ?? null);
  connection.answer('git/changes', ({ session }) => changes(session));

  connection.answer('git/diff', async ({ session, file }) => {
    const repos = lastChanges.get(session) ?? (await changes(session));
    const repo = repos.find(({ changes }) => changes.some((change) => change.absolute === file));
    const change = repo?.changes.find((candidate) => candidate.absolute === file);
    if (!repo || !change) throw new RpcError(ApiCode.unknownFile, `${file} has no changes in this session's folder.`);

    return fileDiff(repo.repo, change, repo.since?.base);
  });

  connection.answer('files/list', ({ session }) => listProjectFiles(connection.find(session).folder));
};
