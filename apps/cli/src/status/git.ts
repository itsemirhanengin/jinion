import { execFile } from 'node:child_process';
import { useEffect, useState } from 'react';

export interface GitStatus {
  /** The short commit when HEAD is detached. */
  branch: string;
  /** Files with uncommitted changes, staged or not, untracked ones included. */
  changed: number;
  ahead: number;
  behind: number;
}

/** Runs `git status` in the background whenever `refresh` changes. `undefined` outside a repository. */
export function useGitStatus(cwd: string, enabled: boolean, refresh: unknown) {
  const [status, setStatus] = useState<GitStatus>();

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    execFile('git', ['status', '--porcelain=v2', '--branch'], { cwd, timeout: 5_000 }, (error, stdout) => {
      if (current) setStatus(error ? undefined : parseGitStatus(stdout));
    });
    return () => {
      current = false;
    };
  }, [cwd, enabled, refresh]);

  return enabled ? status : undefined;
}

export function parseGitStatus(output: string): GitStatus {
  const status: GitStatus = { branch: '', changed: 0, ahead: 0, behind: 0 };
  let commit = '';
  for (const line of output.split('\n')) {
    if (line.startsWith('# branch.head ')) status.branch = line.slice('# branch.head '.length);
    else if (line.startsWith('# branch.oid ')) commit = line.slice('# branch.oid '.length);
    else if (line.startsWith('# branch.ab ')) {
      const counts = /\+(\d+) -(\d+)/.exec(line);
      status.ahead = Number(counts?.[1] ?? 0);
      status.behind = Number(counts?.[2] ?? 0);
    } else if (line && !line.startsWith('#')) status.changed++;
  }
  if (status.branch === '(detached)') status.branch = commit.slice(0, 7);
  return status;
}
