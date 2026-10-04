import { useEffect, useState } from 'react';
import { printable } from '@jinion/tui';
import { readTail } from '@jinion/core/lib/tail';

const POLL_MS = 500;
/** A dev server can write a lot. */
const MAX_BYTES = 256 * 1024;

export function useOutput(path: string | undefined, live: boolean) {
  const [lines, setLines] = useState<string[]>();

  useEffect(() => {
    if (!path) return;

    const read = () => setLines(printable(readTail(path, MAX_BYTES).join('\n')).split('\n'));

    read();
    if (!live) return;

    const timer = setInterval(read, POLL_MS);

    return () => clearInterval(timer);
  }, [path, live]);

  return lines;
}
