import { isPrompt, nextId, type ChangedFile, type Entry } from './entries.js';

/** From the agent's edits rather than git, for `/diff`'s turn views. */
export interface EditTurn {
  id: string;
  prompt: string;
  edits: Edit[];
}

export interface Edit {
  path: string;
  patch: string;
  created?: boolean;
}

/** Newest first. A message that joined a running turn belongs to it; a failed or cancelled call changed nothing. */
export function editTurns(entries: Entry[]): EditTurn[] {
  const turns: EditTurn[] = [];

  for (const entry of entries) {
    if (isPrompt(entry)) turns.push({ id: entry.id, prompt: entry.text, edits: [] });
    turns.at(-1)?.edits.push(...editsOf(entry));
  }

  return turns.filter((turn) => turn.edits.length > 0).reverse();
}

function editsOf(entry: Entry): Edit[] {
  if (entry.kind !== 'tool') return [];

  return [entry, ...(entry.children ?? [])].flatMap((call) =>
    call.run.name === 'edit' && call.status === 'done'
      ? [{ path: call.run.input.path, patch: call.run.result?.patch ?? call.run.input.patch, created: call.run.input.created }]
      : [],
  );
}

export function changedFiles(edits: Edit[]): (ChangedFile & { patch: string })[] {
  const files = new Map<string, { patches: string[]; created: boolean }>();

  for (const edit of edits) {
    const file = files.get(edit.path) ?? { patches: [], created: false };

    file.patches.push(edit.patch);
    file.created ||= edit.created === true;
    files.set(edit.path, file);
  }

  return [...files].map(([path, file]) => {
    const patch = file.patches.join('\n');
    const lines = patch.split('\n');

    return {
      path,
      created: file.created,
      added: lines.filter((line) => line.startsWith('+')).length,
      removed: lines.filter((line) => line.startsWith('-')).length,
      patch,
    };
  });
}

/** A turn the agent started itself goes with the message before it, as in `/diff`. */
export function turnChanges(entries: Entry[], from: number): Entry | undefined {
  const files = changedFiles(entries.slice(from).flatMap(editsOf)).map(({ patch: _, ...file }) => file);
  const turn = entries.slice(0, from + 1).findLast(isPrompt);
  if (files.length === 0 || !turn) return undefined;

  return { id: nextId(), kind: 'changes', turn: turn.id, files };
}
