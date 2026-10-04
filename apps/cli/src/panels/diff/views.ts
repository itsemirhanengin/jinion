import type { ReactNode } from 'react';
import { changedFiles, type EditTurn } from '@jinion/core/conversation/edits';
import type { FileChange } from '@jinion/core/api/protocol';
import { plural } from '@jinion/core/lib/format';
import { firstFilledLine, truncate } from '@jinion/core/lib/text';

const TURN_LABEL = 24;

export interface ChangeRow {
  key: string;
  group?: { label: string; aside?: string };
  file: string;
  kind: FileChange['kind'];
  insertions: number;
  deletions: number;
  binary?: boolean;
  agent?: boolean;
  where: string;
  patch(): Promise<string>;
}

export interface View {
  label: string;
  turn?: string;
  rows?: ChangeRow[];
  subtitle?: string;
  empty: string;
  note?: ReactNode;
}

export function turnView(turn: EditTurn): View {
  const rows = changedFiles(turn.edits).map(
    (file): ChangeRow => ({
      key: file.path,
      file: file.path,
      kind: file.created ? 'added' : 'modified',
      insertions: file.added,
      deletions: file.removed,
      where: file.path,
      patch: async () => file.patch,
    }),
  );

  const prompt = firstFilledLine(turn.prompt);

  return {
    label: truncate(prompt, TURN_LABEL),
    turn: turn.id,
    rows,
    subtitle: [`“${truncate(prompt, 60)}”`, ...totals(rows)].join(' · '),
    empty: '',
  };
}

export function totals(rows: ChangeRow[]) {
  const insertions = rows.reduce((total, row) => total + row.insertions, 0);
  const deletions = rows.reduce((total, row) => total + row.deletions, 0);

  return [plural(rows.length, 'file'), `+${insertions} -${deletions}`];
}
