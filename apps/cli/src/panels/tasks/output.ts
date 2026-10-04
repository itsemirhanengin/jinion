import { useEffect, useState } from 'react';
import { printable } from '@jinion/tui';
import { useApi } from '../../app/api.js';

const POLL_MS = 500;

/** The end of what task `id` wrote, read again while it runs; nothing for a task that writes none. */
export function useOutput(id: string | undefined, live: boolean) {
  const api = useApi();

  const [lines, setLines] = useState<string[]>();

  useEffect(() => {
    if (id === undefined) return;

    let open = true;

    const read = () =>
      api.inSession('session/task-output', { task: id }).then(
        (tail) => open && tail && setLines(printable(tail.join('\n')).split('\n')),
        () => {},
      );

    void read();

    const timer = live ? setInterval(read, POLL_MS) : undefined;

    return () => {
      open = false;
      clearInterval(timer);
    };
  }, [id, live]);

  return lines;
}
