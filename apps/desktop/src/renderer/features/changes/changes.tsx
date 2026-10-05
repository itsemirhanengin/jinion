import { changedFiles, editTurns } from '@jinion/core/conversation/edits';
import { ChoiceMenu, LineCounts, Pill } from '@jinion/ui';
import { DiffCard } from '@jinion/ui/chat';
import type { Feature, Workbench } from '@jinion/workbench';
import { useRef, useState } from 'react';
import type { Core } from '../../core/core.js';
import { diffLines } from '../../lib/diff.js';
import { reveal, useReveal } from '../../state/reveal.js';
import { changesOf, useCore, useSession } from '../../state/session.js';

/** What a thread changed, as a tab of its own: every file's diff one under another, for the whole thread or one turn. */
export function changes(): Feature {
  return { id: 'changes', tabs: [{ kind: 'changes', Title: () => 'Changes', Content: ChangesTab }] };
}

/** Opens the thread's changes, scrolled to `path` when given. */
export function openChanges(core: Core, workbench: Workbench, session: string, path?: string) {
  workbench.open({ kind: 'changes', id: session });
  if (path) reveal(core, `changes:${session}`, path);
}

const ALL = 'all';

function ChangesTab({ id }: { id: string }) {
  const core = useCore();
  const snapshot = useSession(core, id);

  const [turn, setTurn] = useState(ALL);
  const list = useRef<HTMLDivElement>(null);

  const turns = snapshot ? editTurns(snapshot.state.entries) : [];
  const picked = turns.find((each) => each.id === turn);
  const files = picked ? changedFiles(picked.edits) : snapshot ? changesOf(snapshot) : [];
  const added = files.reduce((sum, file) => sum + file.added, 0);
  const removed = files.reduce((sum, file) => sum + file.removed, 0);

  useReveal(`changes:${id}`, list, files.length);

  if (!snapshot) return <Note>This thread is closed, and its changes with it.</Note>;
  if (turns.length === 0) return <Note>The files this thread changes show here, each with its diff.</Note>;

  return (
    <div ref={list} className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-240 flex-col gap-4 px-8 py-6">
        <div className="flex items-center gap-3">
          <p className="font-medium">
            {files.length} {files.length === 1 ? 'file' : 'files'} changed
          </p>
          <LineCounts added={added} removed={removed} />
          <div className="flex-1" />
          <ChoiceMenu
            value={turn}
            onChange={setTurn}
            groups={[
              { choices: [{ value: ALL, label: 'The whole thread' }] },
              {
                label: 'One turn',
                choices: turns.map((each, index) => ({ value: each.id, label: each.prompt, hint: index === 0 ? 'Last' : undefined })),
              },
            ]}
            trigger={<Pill className="max-w-80">{picked ? picked.prompt : 'The whole thread'}</Pill>}
          />
        </div>
        {files.map((file) => (
          <div key={file.path} data-path={file.path} className="scroll-mt-4">
            <DiffCard path={file.path} lines={diffLines(file.patch)} folded={Number.POSITIVE_INFINITY} bare />
          </div>
        ))}
      </div>
    </div>
  );
}

function Note({ children }: { children: string }) {
  return <p className="mx-auto max-w-120 px-8 py-16 text-center text-pretty text-muted">{children}</p>;
}
