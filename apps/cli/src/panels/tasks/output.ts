import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { useEffect, useState } from 'react';
import { printable } from '@jinion/tui';

const POLL_MS = 500;
/** The end of the output is what matters; a dev server can write a lot. */
const MAX_BYTES = 256 * 1024;

export function useOutput(path: string | undefined, live: boolean) {
  const [lines, setLines] = useState<string[]>();
  useEffect(() => {
    if (!path) return;
    const read = () => setLines(readOutput(path));
    read();
    if (!live) return;
    const timer = setInterval(read, POLL_MS);
    return () => clearInterval(timer);
  }, [path, live]);
  return lines;
}

function readOutput(path: string, maxBytes = MAX_BYTES) {
  let fd: number | undefined;
  try {
    fd = openSync(path, 'r');
    const size = fstatSync(fd).size;
    const length = Math.min(size, maxBytes);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    let text = buffer.toString('utf8');
    // A cut at the start leaves half a line.
    if (length < size) text = text.slice(text.indexOf('\n') + 1);
    return printable(text.replace(/\n$/, '')).split('\n');
  } catch {
    return [];
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
