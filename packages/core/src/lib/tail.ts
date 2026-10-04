import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

/** The end of a file as lines, such as a task's output, of which the end is what matters; `[]` when it can't be read. */
export function readTail(path: string, maxBytes: number) {
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

    return text.replace(/\n$/, '').split('\n');
  } catch {
    return [];
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
