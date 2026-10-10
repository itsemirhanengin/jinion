import { changedFiles, editTurns } from '@jinion/core/conversation/edits';
import { ChoiceMenu, LineCounts, Pill, VirtualList, type VirtualListHandle } from '@jinion/ui';
import { DiffCard } from '@jinion/ui/chat';
import type { Feature, Workbench } from '@jinion/workbench';
import { useRef, useState } from 'react';
import type { Core } from '../../core/core.js';
import { diffLines } from '../../lib/diff.js';
import { diffHeight, drawable, SHOWN_LINES } from '../../lib/diff-view.js';
import { reveal, useReveal } from '../../state/reveal.js';
import { changesOf, useCore, useSession } from '../../state/session.js';
import { CommentsBar } from '../comments/comments-bar.js';
import { useComments } from '../comments/use-comments.js';

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
  const list = useRef<VirtualListHandle>(null);

  const commentsOn = useComments(id, 'changes');

  const turns = snapshot ? editTurns(snapshot.state.entries) : [];
  const picked = turns.find((each) => each.id === turn);
  const files = picked ? changedFiles(picked.edits) : snapshot ? changesOf(snapshot) : [];
  const added = files.reduce((sum, file) => sum + file.added, 0);
  const removed = files.reduce((sum, file) => sum + file.removed, 0);

  useReveal(`changes:${id}`, (path) => list.current?.scrollTo(path), files.length);

  if (!snapshot) return <Note>This thread is closed, and its changes with it.</Note>;
  if (turns.length === 0) return <Note>The files this thread changes show here, each with its diff.</Note>;

  return (
    <VirtualList
      handle={list}
      items={files}
      keyOf={(file) => file.path}
      estimate={(file) => diffHeight(file.added, file.removed)}
      gap={16}
      className="h-full"
      innerClassName="mx-auto max-w-240 px-8 py-6"
      header={
        <div className="flex items-center gap-3 pb-4">
          <p className="font-medium">
            {files.length} {files.length === 1 ? 'file' : 'files'} changed
          </p>
          <LineCounts added={added} removed={removed} />
          <div className="flex-1" />
          <CommentsBar session={id} />
          <ChoiceMenu
            value={turn}
            onChange={setTurn}
            groups={[
              { choices: [{ value: ALL, label: 'The whole thread' }] },
              {
                label: 'One turn',
                choices: turns.map((each, index) => ({ value: each.id, label: firstLine(each.prompt), hint: index === 0 ? 'Last' : undefined })),
              },
            ]}
            trigger={<Pill className="max-w-80">{picked ? firstLine(picked.prompt) : 'The whole thread'}</Pill>}
          />
        </div>
      }
    >
      {(file) => {
        const lines = diffLines(file.patch);

        return <DiffCard path={file.path} lines={drawable(lines)} folded={SHOWN_LINES} bare {...commentsOn(file.path, lines)} />;
      }}
    </VirtualList>
  );
}

/** A turn by its message's first line that has words, as a long message would make a long line of all of them. */
function firstLine(prompt: string) {
  return prompt.split('\n').find((line) => line.trim() !== '')?.trim() ?? prompt;
}

function Note({ children }: { children: string }) {
  return <p className="mx-auto max-w-120 px-8 py-16 text-center text-pretty text-muted">{children}</p>;
}
