export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export function hunksToPatch(hunks: Hunk[]) {
  return hunks
    .flatMap((hunk) => [`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`, ...hunk.lines])
    .join('\n');
}

/** A preview until Claude Code reports the applied patch with real line numbers. */
export function replacePatch(before: string, after: string) {
  const removed = splitLines(before);
  const added = splitLines(after);

  return [
    `@@ -1,${removed.length} +1,${added.length} @@`,
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
  ].join('\n');
}

export function addPatch(content: string) {
  const lines = splitLines(content);

  return [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join('\n');
}

export function deletePatch(content: string) {
  const lines = splitLines(content);

  return [`@@ -1,${lines.length} +0,0 @@`, ...lines.map((line) => `-${line}`)].join('\n');
}

export const splitLines = (value: string) => (value ? value.replace(/\n$/, '').split('\n') : []);
