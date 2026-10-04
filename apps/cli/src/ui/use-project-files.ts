import { useEffect, useState } from 'react';
import { listProjectFiles } from '@jinion/core/prompt/files';

export function useProjectFiles(cwd: string, refresh: unknown) {
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    let current = true;

    listProjectFiles(cwd).then(
      (listed) => current && setFiles(listed),
      () => {},
    );

    return () => {
      current = false;
    };
  }, [cwd, refresh]);

  return files;
}
