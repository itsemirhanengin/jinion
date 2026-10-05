import type { SessionState } from '@jinion/core/conversation/session';
import type { Entry, ToolCallEntry, ToolEntry } from '@jinion/core/conversation/entries';
import { inRunningTurn } from '@jinion/core/conversation/session';
import type { ToolRun } from '@jinion/core/agent/tools';
import { ChangesCard, CommandCard, DiffCard, Notice, Prose, Thinking, Todos, ToolGroup, ToolLine, UserMessage } from '@jinion/ui/chat';
import type { ReactNode } from 'react';
import { diffLines } from '../../lib/diff.js';
import { took } from '../../lib/time.js';

export interface EntryActions {
  rewind(entry: string): void;
  openChange(path: string): void;
}

type Item = Entry | { kind: 'explored'; id: string; calls: ToolEntry[] };

const EXPLORING = new Set<ToolRun['name']>(['read', 'grep', 'glob']);

/** The conversation's entries as the window draws them: reads and searches in a row fold into one line. */
export function Entries({ state, actions }: { state: SessionState; actions: EntryActions }) {
  const items: Item[] = [];
  const latestTodos = latestTodosOfEachTurn(state.entries);

  state.entries.forEach((entry, index) => {
    // A running turn's todos show above the composer instead, and come back as one line, the last, when it ends.
    if (entry.kind === 'tool' && entry.run.name === 'todo' && (inRunningTurn(state, index) || !latestTodos.has(entry.id))) return;

    const last = items.at(-1);

    if (entry.kind === 'tool' && EXPLORING.has(entry.run.name)) {
      if (last?.kind === 'explored') last.calls.push(entry);
      else items.push({ kind: 'explored', id: entry.id, calls: [entry] });

      return;
    }

    items.push(entry);
  });

  return items.map((item) => <EntryView key={item.id} item={item} actions={actions} />);
}

function EntryView({ item, actions }: { item: Item; actions: EntryActions }): ReactNode {
  switch (item.kind) {
    case 'banner':
      return null;

    case 'user':
      return <UserMessage text={item.text} onRewind={() => actions.rewind(item.id)} />;

    case 'thinking':
      return (
        <Thinking text={item.text} took={item.endedAt && item.startedAt ? took(item.endedAt - item.startedAt) : undefined} />
      );

    case 'text':
      return <Prose text={item.text} />;

    case 'notice':
      return <Notice text={item.text} tone={item.tone} />;

    case 'compaction':
      return <Notice text="The conversation was compacted to make room." />;

    case 'task':
      return <Notice text={`${item.task.title} ${item.task.status}.`} />;

    case 'changes':
      return <ChangesCard files={item.files} onOpen={actions.openChange} />;

    case 'explored':
      return (
        <ToolGroup title="Explored" summary={summarize(item.calls)}>
          {item.calls.map((call) => (
            <ToolLine key={call.id} {...describe(call.run)} />
          ))}
        </ToolGroup>
      );

    case 'tool':
      return <ToolView entry={item} actions={actions} />;
  }
}

function ToolView({ entry, actions }: { entry: ToolEntry; actions: EntryActions }) {
  const { run } = entry;

  switch (run.name) {
    case 'edit':
      return <DiffCard path={run.input.path} lines={diffLines(run.result?.patch ?? run.input.patch)} onOpen={() => actions.openChange(run.input.path)} />;

    case 'bash':
      return (
        <CommandCard
          command={run.input.command}
          output={entry.output}
          exitCode={entry.status === 'running' ? undefined : run.result?.exitCode}
          took={entry.endedAt ? took(entry.endedAt - entry.startedAt) : undefined}
          background={run.result?.background !== undefined}
        />
      );

    case 'todo':
      return <Todos groups={run.input.groups} />;

    case 'agent':
      return <Subagent description={run.input.description} calls={entry.children ?? []} />;

    case 'plan':
      return (
        <div className="rounded-xl border border-accent/30 bg-accent-soft/30 px-4 py-3">
          <Prose text={run.input.plan} />
        </div>
      );

    default:
      return <ToolLine {...describe(run)} />;
  }
}

function Subagent({ description, calls }: { description: string; calls: ToolCallEntry[] }) {
  return (
    <ToolGroup title={description} summary={`${calls.length} ${calls.length === 1 ? 'call' : 'calls'}`}>
      {calls.map((call) => (
        <ToolLine key={call.id} {...describe(call.run)} />
      ))}
    </ToolGroup>
  );
}

function latestTodosOfEachTurn(entries: Entry[]) {
  const latest = new Set<string>();
  let last: string | undefined;

  for (const entry of entries) {
    if (entry.kind === 'user' && !entry.steered) {
      if (last) latest.add(last);
      last = undefined;
    } else if (entry.kind === 'tool' && entry.run.name === 'todo') last = entry.id;
  }

  if (last) latest.add(last);

  return latest;
}

function summarize(calls: ToolEntry[]) {
  const files = calls.filter((call) => call.run.name === 'read').flatMap((call) => (call.run.name === 'read' ? call.run.input.files : []));
  const searches = calls.length - calls.filter((call) => call.run.name === 'read').length;
  const parts = [];

  if (files.length > 0) parts.push(`${files.length} ${files.length === 1 ? 'file' : 'files'}`);
  if (searches > 0) parts.push(`${searches} ${searches === 1 ? 'search' : 'searches'}`);

  return parts.join(', ');
}

function describe(run: ToolRun): { label: string; detail?: string } {
  switch (run.name) {
    case 'read':
      return { label: 'Read', detail: run.input.files.map((file) => file.path).join(', ') };
    case 'grep':
      return { label: 'Searched', detail: `"${run.input.pattern}" in ${run.input.path}` };
    case 'glob':
      return { label: 'Listed', detail: run.result ? `${run.input.pattern}, ${run.result.files.length} files` : run.input.pattern };
    case 'edit':
      return { label: run.input.created ? 'Created' : 'Edited', detail: run.input.path };
    case 'bash':
      return { label: 'Ran', detail: run.input.command };
    case 'fetch':
      return { label: 'Fetched', detail: run.input.url };
    case 'search':
      return { label: 'Searched the web', detail: run.input.query };
    case 'mcp':
      return { label: run.input.server, detail: run.input.tool };
    case 'memory':
      return { label: 'Memory', detail: run.input.detail };
    case 'agent':
      return { label: 'Agent', detail: run.input.description };
    case 'todo':
      return { label: 'Updated the todos' };
    case 'ask':
      return { label: 'Asked', detail: run.input.questions.map((question) => question.prompt).join(' ') };
    case 'plan':
      return { label: 'Planned' };
    case 'other':
      return { label: run.input.title, detail: run.input.detail };
  }
}
