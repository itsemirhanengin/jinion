import { useRef, useState } from 'react';
import { ChoiceList, choiceIndent, Panel, Text, useChoiceList, usePanel, useTheme, type Choice } from '@jinion/tui';
import type { FileChanges, RewindScope } from '@jinion/core/agent/agent';
import type { RewindPoint } from '@jinion/core/controllers/conversation';
import { plural } from '@jinion/core/lib/format';
import { firstFilledLine as firstLine } from '@jinion/core/lib/text';
import { useAsync } from '../../ui/use-async.js';
import { Changes } from './changes.js';

export interface RewindPanelProps {
  points: RewindPoint[];
  preview(point: RewindPoint): Promise<FileChanges | undefined>;
  onRewind(point: RewindPoint, scope: RewindScope): void;
}

const VISIBLE = 8;

export function RewindPanel({ points, preview, onRewind }: RewindPanelProps) {
  const [picked, setPicked] = useState<RewindPoint>();
  // Each preview asks the agent once, however often the focus comes back to it.
  const previews = useRef(new Map<string, Promise<FileChanges | undefined>>());

  const previewOf = (point: RewindPoint) => {
    let changes = previews.current.get(point.promptId);

    if (!changes) {
      changes = preview(point).catch(() => undefined);
      previews.current.set(point.promptId, changes);
    }

    return changes;
  };

  return picked ? (
    <ScopeStep point={picked} changes={previewOf(picked)} onBack={() => setPicked(undefined)} onPick={(scope) => onRewind(picked, scope)} />
  ) : (
    <PointStep points={points} previewOf={previewOf} onPick={setPicked} />
  );
}

interface PointStepProps {
  points: RewindPoint[];
  previewOf(point: RewindPoint): Promise<FileChanges | undefined>;
  onPick(point: RewindPoint): void;
}

function PointStep({ points, previewOf, onPick }: PointStepProps) {
  const { close } = usePanel();

  const list = useChoiceList({
    keys: points.map((point) => point.entry),
    mode: 'single',
    onCancel: close,
    onSubmit: ([entry]) => {
      const point = points.find((candidate) => candidate.entry === entry);

      if (point) onPick(point);
    },
  });

  // Only the focused message is previewed, so moving through the list asks the agent one message at a time.
  const choices: Choice[] = points.map((point) => ({
    key: point.entry,
    label: firstLine(point.text),
    editor: point.entry === list.focus ? <Changes changes={previewOf(point)} indent={choiceIndent(list)} /> : undefined,
  }));

  return (
    <Panel
      title="Rewind"
      subtitle={plural(points.length, 'message')}
      hints={[
        ['Enter', 'pick'],
        ['Up/Down', 'move'],
        ['Esc', 'cancel'],
      ]}
    >
      <ChoiceList list={list} choices={choices} limit={VISIBLE} />
    </Panel>
  );
}

/** Claude Code's choices, in its words, so they read the same as there. */
const SCOPES: { key: string; label: string; description: string; scope: RewindScope }[] = [
  {
    key: 'both',
    label: 'Restore code and conversation',
    description: 'Files go back, and the conversation goes on from before this message, which goes back into the prompt',
    scope: { code: true, conversation: true },
  },
  {
    key: 'conversation',
    label: 'Restore conversation',
    description: 'The conversation goes on from before this message; the files stay as they are',
    scope: { code: false, conversation: true },
  },
  {
    key: 'code',
    label: 'Restore code',
    description: 'Files go back; the conversation goes on as it is',
    scope: { code: true, conversation: false },
  },
];

const NEVER_MIND = { key: 'never-mind', label: 'Never mind', description: 'Back to the messages' };

interface ScopeStepProps {
  point: RewindPoint;
  changes: Promise<FileChanges | undefined>;
  onBack(): void;
  onPick(scope: RewindScope): void;
}

function ScopeStep({ point, changes, onBack, onPick }: ScopeStepProps) {
  const theme = useTheme();
  const { close } = usePanel();

  const known = useAsync(() => changes, [changes]);

  // Restoring code is offered only where there are file changes to take back.
  const options =
    known.state === 'pending' ? [] : [...SCOPES.filter((scope) => (known.state === 'done' && known.value) || !scope.scope.code), NEVER_MIND];

  const list = useChoiceList({
    keys: options.map((option) => option.key),
    mode: 'single',
    onCancel: onBack,
    onSubmit: ([key]) => {
      const scope = SCOPES.find((candidate) => candidate.key === key);
      if (!scope) return onBack();

      close();
      onPick(scope.scope);
    },
  });

  return (
    <Panel
      title="Rewind to before"
      subtitle={firstLine(point.text)}
      header={<Changes changes={changes} indent={0} />}
      hints={[
        ['Enter', 'rewind'],
        ['Up/Down', 'move'],
        ['Esc', 'back'],
      ]}
    >
      <ChoiceList
        list={list}
        choices={options.map(({ key, label, description }) => ({ key, label, description: <Text color={theme.muted}>{description}</Text> }))}
      />
    </Panel>
  );
}
