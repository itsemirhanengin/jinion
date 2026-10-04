import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { editTurnsAtom } from '@jinion/core/state/session';
import { ChangeList } from './change-list.js';
import { useCurrentView } from './current-view.js';
import { FileDiff } from './file-diff.js';
import { turnView, type ChangeRow } from './views.js';

export interface DiffPanelProps {
  turn?: string;
  file?: string;
}

/** As in Claude Code, plus a view per turn with just its edits. */
export function DiffPanel({ turn, file }: DiffPanelProps) {
  const current = useCurrentView();
  const turns = useAtomValue(editTurnsAtom);

  // Kept by the turn's id, so a turn that ends while the panel is open doesn't move what is shown.
  const [activeTurn, setActiveTurn] = useState(() => (turns.some((candidate) => candidate.id === turn) ? turn : undefined));

  const views = [current, ...turns.map(turnView)];
  const active = Math.max(0, views.findIndex((view) => view.turn === activeTurn));
  const [open, setOpen] = useState<ChangeRow | undefined>(() => views[active]?.rows?.find((row) => row.file === file));

  if (open) return <FileDiff row={open} onBack={() => setOpen(undefined)} />;

  return (
    <ChangeList
      key={active}
      views={views}
      active={active}
      onSwitch={(step) => setActiveTurn(views[Math.min(views.length - 1, Math.max(0, active + step))]?.turn)}
      onOpen={setOpen}
    />
  );
}
