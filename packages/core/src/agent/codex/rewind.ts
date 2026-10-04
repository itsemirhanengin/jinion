import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FileChanges } from '../agent.js';
import { splitLines } from '../patches.js';
import type { FileUpdateChange, Turn } from './protocol.js';

/** The patches Codex applied from turn `id` on, in the order it applied them. */
export function changesFrom(turns: Turn[], id: string): FileUpdateChange[] | undefined {
  const index = turns.findIndex((turn) => turn.id === id);
  if (index === -1) return undefined;

  return turns
    .slice(index)
    .flatMap((turn) => turn.items)
    .flatMap((item) => (item.type === 'fileChange' && item.status === 'completed' ? item.changes : []));
}

/** What undoing them changes, counted the way it changes the files: an added file comes out, a deleted one back. */
export function previewOf(changes: FileUpdateChange[]): FileChanges | undefined {
  if (changes.length === 0) return undefined;

  let insertions = 0;
  let deletions = 0;

  for (const { kind, diff } of changes) {
    if (kind.type === 'add') deletions += splitLines(diff).length;
    else if (kind.type === 'delete') insertions += splitLines(diff).length;
    else {
      for (const line of diff.split('\n')) {
        if (line.startsWith('+')) deletions++;
        else if (line.startsWith('-')) insertions++;
      }
    }
  }

  return { files: [...new Set(changes.map((change) => change.path))], insertions, deletions };
}

/**
 * Puts the files back as they were before the patches, newest first. Every file is worked out before any is written,
 * so a file that changed since in a way the patches can't be undone on leaves all of them as they are.
 */
export function restore(changes: FileUpdateChange[]) {
  const files = new Map<string, string | null>();
  const read = (path: string) => (files.has(path) ? files.get(path)! : existsSync(path) ? readFileSync(path, 'utf8') : null);

  for (const { path, kind, diff } of [...changes].reverse()) {
    if (kind.type === 'add') files.set(path, null);
    else if (kind.type === 'delete') files.set(path, diff);
    else {
      const now = kind.move_path ?? path;
      const content = read(now);
      if (content === null) throw new Error(`${now} is gone, so its changes can't be undone`);

      if (kind.move_path) files.set(kind.move_path, null);
      files.set(path, unpatch(content, diff, now));
    }
  }

  for (const [path, content] of files) {
    if (content === null) rmSync(path, { force: true });
    else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
    }
  }
}

interface Hunk {
  /** Where the new side starts, counted from 1. */
  start: number;
  before: string[];
  after: string[];
}

/** `content` with the hunks of `diff` taken back, bottom first so the ones above keep their place. */
function unpatch(content: string, diff: string, path: string) {
  const ending = content.endsWith('\n') ? '\n' : '';
  const lines = content ? content.replace(/\n$/, '').split('\n') : [];

  for (const hunk of hunks(diff).reverse()) {
    const at = locate(lines, hunk.after, hunk.start - 1);
    if (at === -1) throw new Error(`${path} changed since, so its changes can't be undone`);

    lines.splice(at, hunk.after.length, ...hunk.before);
  }

  return lines.length > 0 ? `${lines.join('\n')}${ending}` : '';
}

function hunks(diff: string): Hunk[] {
  const found: Hunk[] = [];

  for (const line of diff.replace(/\n$/, '').split('\n')) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);

    if (header) found.push({ start: Number(header[1]), before: [], after: [] });
    else if (line.startsWith('\\')) continue;
    else {
      const hunk = found.at(-1);
      if (!hunk) continue;

      const text = line.slice(1);

      if (!line.startsWith('+')) hunk.before.push(text);
      if (!line.startsWith('-')) hunk.after.push(text);
    }
  }

  return found;
}

/** Where `block` is: at `expected` when it still is, or else the nearest place it is, as patch looks for it. */
function locate(lines: string[], block: string[], expected: number) {
  const at = (index: number) => index >= 0 && index + block.length <= lines.length && block.every((line, offset) => lines[index + offset] === line);
  if (at(expected)) return expected;

  for (let distance = 1; distance < lines.length; distance++) {
    if (at(expected - distance)) return expected - distance;
    if (at(expected + distance)) return expected + distance;
  }

  return -1;
}
