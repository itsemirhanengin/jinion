import { useEffect, useState } from 'react';
import { useApi } from '../app/api.js';
import { useWorkdir } from './use-workdir.js';

/** The files of the folder the shown session works in, read again each time `refresh` changes. */
export function useProjectFiles(refresh: unknown) {
  const api = useApi();
  const folder = useWorkdir();

  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    let current = true;

    api.inSession('files/list', {}).then(
      (listed) => current && setFiles(listed),
      () => {},
    );

    return () => {
      current = false;
    };
  }, [folder, refresh]);

  return files;
}
