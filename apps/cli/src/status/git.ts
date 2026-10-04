import { useEffect, useState } from 'react';
import { readGitStatus, type GitStatus } from '../git/status.js';

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
