import { useEffect, useState } from 'react';
import type { GitStatus } from '@jinion/core/api/protocol';
import { useApi } from '../app/api.js';

/** Of the folder the shown session works in, read again as `folder` or `refresh` changes; the last one stays shown meanwhile. */
export function useGitStatus(folder: string, enabled: boolean, refresh: unknown) {
  const api = useApi();

  const [status, setStatus] = useState<GitStatus>();

  useEffect(() => {
    if (!enabled) return;

    let current = true;

    api.inSession('git/status', {}).then(
      (found) => current && setStatus(found ?? undefined),
      () => {},
    );

    return () => {
      current = false;
    };
  }, [folder, enabled, refresh]);

  return enabled ? status : undefined;
}
