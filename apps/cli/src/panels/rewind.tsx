import { relative } from 'node:path';
import { useEffect, useRef, useState } from 'react';
import { Box, ChoiceList, choiceIndent, Panel, Text, useChoiceList, usePanel, useTheme, type Choice } from '@jinion/tui';
import type { FileChanges, RewindScope } from '../agent/types.js';
import { useJinion } from '../context.js';

/** A message of the conversation the agent can go back to before. */
export interface RewindPoint {
  /** The conversation entry. */
  entry: string;
  /** What the agent calls the message. */
  promptId: string;
  text: string;
}

export interface RewindPanelProps {
  /** Newest first. */
  points: RewindPoint[];
  preview(point: RewindPoint): Promise<FileChanges | undefined>;
  onRewind(point: RewindPoint, scope: RewindScope): void;
}

const VISIBLE = 8;
const FILES_SHOWN = 3;

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

const firstLine = (text: string) => text.split('\n').find((line) => line.trim()) ?? text;

/**
 * `/rewind` or esc twice: the messages of the conversation, newest first, with what going back to before each would
 * change in files; then whether to take back the code, the conversation or both.
 */
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

function PointStep({
  points,
  previewOf,
  onPick,
}: {
  points: RewindPoint[];
  previewOf(point: RewindPoint): Promise<FileChanges | undefined>;
  onPick(point: RewindPoint): void;
}) {
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
      subtitle={`${points.length === 1 ? '1 message' : `${points.length} messages`}`}
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

function ScopeStep({
  point,
  changes,
  onBack,
  onPick,
}: {
  point: RewindPoint;
  changes: Promise<FileChanges | undefined>;
  onBack(): void;
  onPick(scope: RewindScope): void;
}) {
  const theme = useTheme();
  const { close } = usePanel();
  // Restoring code is offered only where there are file changes to take back.
  const [known, setKnown] = useState<{ changes?: FileChanges }>();
  useEffect(() => {
    let current = true;
    void changes.then((result) => current && setKnown({ changes: result }));
    return () => {
      current = false;
    };
  }, [changes]);
  const options = !known ? [] : [...SCOPES.filter((scope) => known.changes || !scope.scope.code), NEVER_MIND];
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

/** What going back would change in files, once the agent has said. */
function Changes({ changes, indent }: { changes: Promise<FileChanges | undefined>; indent: number }) {
  const app = useJinion();
  const theme = useTheme();
  const [shown, setShown] = useState<{ changes?: FileChanges } | undefined>();

  useEffect(() => {
    let current = true;
    void changes.then((result) => current && setShown({ changes: result }));
    return () => {
      current = false;
    };
  }, [changes]);

  if (!shown) {
    return (
      <Box paddingLeft={indent}>
        <Text color={theme.muted}>Checking what would change…</Text>
      </Box>
    );
  }
  if (!shown.changes) {
    return (
      <Box paddingLeft={indent}>
        <Text color={theme.muted}>No file changes since then</Text>
      </Box>
    );
  }
  const { files, insertions, deletions } = shown.changes;
  const names = files.slice(0, FILES_SHOWN).map((file) => relative(app.info.cwd, file) || file);
  const more = files.length - names.length;
  return (
    <Box paddingLeft={indent} flexDirection="column">
      <Text>
        {files.length === 1 ? '1 file changes' : `${files.length} files change`}
        <Text color={theme.diff.added}> +{insertions}</Text>
        <Text color={theme.diff.removed}> -{deletions}</Text>
      </Text>
      <Text color={theme.muted} wrap="truncate-end">
        {names.join(', ')}
        {more > 0 ? ` … ${more} more` : ''}
      </Text>
    </Box>
  );
}
