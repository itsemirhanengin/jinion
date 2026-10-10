import type { SessionState } from '@jinion/core/conversation/session';
import type { Entry, ToolCallEntry, ToolEntry } from '@jinion/core/conversation/entries';
import { inRunningTurn } from '@jinion/core/conversation/session';
import type { ToolRun } from '@jinion/core/agent/tools';
import { CopyButton, FadeText } from '@jinion/ui';
import { ChangesCard, CommandCard, DiffCard, Notice, Prose, Steps, Thinking, Todos, ToolGroup, ToolLine, Turn, UserMessage, WorkLine } from '@jinion/ui/chat';
import { BookMarked, Bot, ClipboardList, FileSearch, FileText, FolderSearch, Globe, Maximize2, MessageCircleQuestion, Plug, Search, Wrench } from 'lucide-react';
import type { ReactNode } from 'react';
import { diffLines } from '../../lib/diff.js';
import { took } from '../../lib/time.js';
import { planReach, planTitle } from '../plan/plans.js';

export interface EntryActions {
  rewind(entry: string): void;
  openPlan(entry: string): void;
  openChange(path: string): void;
  openFile(path: string, lines?: string): void;
  /** What inline code in the agent's words opens, such as the file it names. */
  openCode(code: string): (() => void) | undefined;
}

type Explored = { kind: 'explored'; id: string; calls: ToolEntry[] };

type Step = Entry | Explored;

type Item = Step | { kind: 'steps'; id: string; steps: Step[] };

const EXPLORING = new Set<ToolRun['name']>(['read', 'grep', 'glob']);

/** Shown as what they are rather than as a step: the todos, the plan. */
const OWN_PLACE = new Set<ToolRun['name']>(['todo', 'plan']);

/**
 * The conversation's entries as the window draws them, a keyed element for each turn, so the conversation can draw only
 * those in view: reads and searches in a row fold into one line, and the steps between the agent's words into one block,
 * live while the turn works on it, folded into a line once done.
 */
export function entryTurns({ state, working, actions }: { state: SessionState; working: boolean; actions: EntryActions }) {
  const steps: Step[] = [];
  const latestTodos = latestTodosOfEachTurn(state.entries);

  state.entries.forEach((entry, index) => {
    // A running turn's todos show above the composer instead, and come back as one line, the last, when it ends.
    if (entry.kind === 'tool' && entry.run.name === 'todo' && (inRunningTurn(state, index) || !latestTodos.has(entry.id))) return;

    const last = steps.at(-1);

    if (entry.kind === 'tool' && EXPLORING.has(entry.run.name)) {
      if (last?.kind === 'explored') last.calls.push(entry);
      else steps.push({ kind: 'explored', id: entry.id, calls: [entry] });

      return;
    }

    steps.push(entry);
  });

  const items = blocksOf(steps);
  const live = working ? items.at(-1) : undefined;

  const turns = turnsOf(items);

  return turns.map((turn, index) => {
    // The answer a turn ends on can be copied, once the turn is over.
    const answer = working && index === turns.length - 1 ? undefined : turn.findLast((item) => item.kind === 'text')?.id;

    return (
      <Turn key={turn[0]!.id}>
        {turn.map((item) => (
          <ItemView key={item.id} item={item} live={item === live} copyable={item.id === answer} actions={actions} />
        ))}
      </Turn>
    );
  });
}

function isStep(step: Step) {
  return step.kind === 'thinking' || step.kind === 'explored' || (step.kind === 'tool' && !OWN_PLACE.has(step.run.name));
}

function blocksOf(steps: Step[]) {
  const items: Item[] = [];

  for (const step of steps) {
    const last = items.at(-1);

    if (!isStep(step)) items.push(step);
    else if (last?.kind === 'steps') last.steps.push(step);
    else items.push({ kind: 'steps', id: step.id, steps: [step] });
  }

  return items;
}

/** Each user message with what came after it, so the message stays on top while its answer scrolls. */
function turnsOf(items: Item[]) {
  const turns: Item[][] = [];

  for (const item of items) {
    if (item.kind === 'user' || turns.length === 0) turns.push([item]);
    else turns.at(-1)!.push(item);
  }

  return turns;
}

function ItemView({ item, live, copyable, actions }: { item: Item; live: boolean; copyable: boolean; actions: EntryActions }): ReactNode {
  if (item.kind === 'text') {
    return (
      <div className="group/text flex flex-col">
        <Prose text={item.text} onCode={actions.openCode} />
        {copyable && <CopyButton text={item.text} label="Copy the answer" className="-mb-1 -ml-1 opacity-0 group-hover/text:opacity-100 focus-visible:opacity-100" />}
      </div>
    );
  }

  if (item.kind !== 'steps') return <StepView step={item} live={live} actions={actions} />;

  const views = item.steps.map((step, index) => <StepView key={step.id} step={step} live={live && index === item.steps.length - 1} actions={actions} />);

  // One step alone says enough by itself; a block folds into a line only when there is more to fold.
  if (item.steps.length === 1) return views;

  const { summary, detail } = summarize(item.steps);

  return (
    <Steps live={live} summary={summary} detail={detail}>
      {views}
    </Steps>
  );
}

/** `live` is the step the running turn is on, the last one. */
function StepView({ step, live, actions }: { step: Step; live: boolean; actions: EntryActions }): ReactNode {
  switch (step.kind) {
    case 'banner':
      return null;

    case 'user':
      return <UserMessage text={step.text} onRewind={() => actions.rewind(step.id)} />;

    case 'thinking':
      return (
        <Thinking
          text={step.text}
          took={step.endedAt && step.startedAt ? took(step.endedAt - step.startedAt) : undefined}
          active={live && step.endedAt === undefined}
        />
      );

    case 'text':
      return <Prose text={step.text} onCode={actions.openCode} />;

    case 'notice':
      return <Notice text={step.text} tone={step.tone} />;

    case 'compaction':
      return <Notice text="The conversation was compacted to make room." />;

    case 'task':
      return <Notice text={`${step.task.title} ${step.task.status}.`} />;

    case 'changes':
      return <ChangesCard files={step.files} onOpen={actions.openChange} onReview={() => step.files[0] && actions.openChange(step.files[0].path)} />;

    case 'explored': {
      const running = live && step.calls.some((call) => call.status === 'running');

      return (
        <ToolGroup icon={<FileSearch />} title={running ? 'Exploring' : 'Explored'} summary={countCalls(step.calls)} active={running}>
          {step.calls.flatMap((call) => callLines(call.run, actions))}
        </ToolGroup>
      );
    }

    case 'tool':
      return <ToolView entry={step} live={live} actions={actions} />;
  }
}

function ToolView({ entry, live, actions }: { entry: ToolEntry; live: boolean; actions: EntryActions }) {
  const { run } = entry;
  const running = live && entry.status === 'running';

  switch (run.name) {
    case 'edit':
      return (
        <DiffCard
          path={run.input.path}
          lines={diffLines(run.result?.patch ?? run.input.patch)}
          active={running}
          onOpen={() => actions.openChange(run.input.path)}
        />
      );

    case 'bash':
      return (
        <CommandCard
          command={run.input.command}
          output={entry.output}
          exitCode={run.result?.exitCode}
          running={running}
          took={entry.endedAt ? took(entry.endedAt - entry.startedAt) : undefined}
          background={run.result?.background !== undefined}
        />
      );

    case 'todo':
      return <Todos groups={run.input.groups} />;

    case 'agent':
      return (
        <ToolGroup icon={<Bot />} title={run.input.description} summary={countCalls(entry.children ?? [])} active={running}>
          {(entry.children ?? []).flatMap((call) => callLines(call.run, actions))}
        </ToolGroup>
      );

    case 'plan':
      return (
        <button
          type="button"
          onClick={() => actions.openPlan(entry.id)}
          title="Open the plan to read it and change it"
          className="flex h-10 cursor-default items-center gap-2 rounded-xl bg-raised pr-3 pl-3 text-left ring-1 ring-edge hover:bg-shade"
        >
          <ClipboardList className="size-4 shrink-0 text-faint" />
          <span className="shrink-0 font-medium">Plan</span>
          <FadeText className="text-muted">{planTitle(run.input.plan)}</FadeText>
          <span className="ml-auto shrink-0 text-faint">{planReach(run.input.plan)}</span>
          <Maximize2 className="size-4 shrink-0 text-faint" />
        </button>
      );

    default: {
      const { icon, label, detail } = describe(run);

      return (
        <WorkLine icon={icon} active={running}>
          <span className="shrink-0">{label}</span>
          {detail && <span className="min-w-0 truncate text-faint">{detail}</span>}
        </WorkLine>
      );
    }
  }
}

/** A call's lines in a group: a read is a line per file, each opening the file at the lines it read. */
function callLines(run: ToolRun, actions: EntryActions) {
  if (run.name === 'read') {
    return run.input.files.map((file) => (
      <ToolLine
        key={`${file.path}:${file.lines ?? ''}`}
        icon={<FileText />}
        label="Read"
        detail={file.path}
        note={file.lines && `lines ${file.lines.replace('-', '–')}`}
        onOpen={() => actions.openFile(file.path, file.lines)}
      />
    ));
  }

  const { icon, label, detail } = describe(run);

  return [<ToolLine key={`${label}:${detail}`} icon={icon} label={label} detail={detail} />];
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

/** `Worked for 14s`, then what it did, counted: `3 files read, 2 searches, 1 command, 1 edit`. */
function summarize(steps: Step[]) {
  const entries = steps.flatMap((step) => (step.kind === 'explored' ? step.calls : [step]));
  const starts = entries.flatMap((entry) => ('startedAt' in entry && entry.startedAt ? [entry.startedAt] : []));
  const ends = entries.flatMap((entry) => ('endedAt' in entry && entry.endedAt ? [entry.endedAt] : []));
  const tools = entries.flatMap((entry) => (entry.kind === 'tool' ? [entry.run] : []));

  const files = tools.flatMap((run) => (run.name === 'read' ? run.input.files : [])).length;
  const searches = tools.filter((run) => run.name === 'grep' || run.name === 'glob').length;
  const commands = tools.filter((run) => run.name === 'bash').length;
  const edits = new Set(tools.flatMap((run) => (run.name === 'edit' ? [run.input.path] : []))).size;
  const others = tools.length - tools.filter((run) => ['read', 'grep', 'glob', 'bash', 'edit'].includes(run.name)).length;

  const parts = [
    files > 0 && `${files} ${files === 1 ? 'file' : 'files'} read`,
    searches > 0 && `${searches} ${searches === 1 ? 'search' : 'searches'}`,
    commands > 0 && `${commands} ${commands === 1 ? 'command' : 'commands'}`,
    edits > 0 && `${edits} ${edits === 1 ? 'file' : 'files'} edited`,
    others > 0 && `${others} more`,
  ].filter(Boolean);

  const time = starts.length > 0 && ends.length > 0 ? took(Math.max(...ends) - Math.min(...starts)) : undefined;

  return { summary: time ? `Worked for ${time}` : 'Worked', detail: parts.join(', ') || undefined };
}

function countCalls(calls: (ToolEntry | ToolCallEntry)[]) {
  const files = calls.flatMap((call) => (call.run.name === 'read' ? call.run.input.files : [])).length;
  const reads = calls.filter((call) => call.run.name === 'read').length;
  const searches = calls.length - reads;
  const parts = [];

  if (files > 0) parts.push(`${files} ${files === 1 ? 'file' : 'files'}`);
  if (searches > 0) parts.push(`${searches} ${searches === 1 ? 'search' : 'searches'}`);

  return parts.join(', ');
}

function describe(run: ToolRun): { icon: ReactNode; label: string; detail?: string } {
  switch (run.name) {
    case 'read':
      return { icon: <FileText />, label: 'Read', detail: run.input.files.map((file) => file.path).join(', ') };
    case 'grep':
      return { icon: <Search />, label: 'Searched', detail: `"${run.input.pattern}" in ${run.input.path}` };
    case 'glob':
      return { icon: <FolderSearch />, label: 'Listed', detail: run.result ? `${run.input.pattern}, ${run.result.files.length} files` : run.input.pattern };
    case 'edit':
      return { icon: <FileText />, label: run.input.created ? 'Created' : 'Edited', detail: run.input.path };
    case 'bash':
      return { icon: <Wrench />, label: 'Ran', detail: run.input.command };
    case 'fetch':
      return { icon: <Globe />, label: 'Fetched', detail: run.input.url };
    case 'search':
      return { icon: <Globe />, label: 'Searched the web', detail: run.input.query };
    case 'mcp':
      return { icon: <Plug />, label: run.input.server, detail: run.input.tool };
    case 'memory':
      return { icon: <BookMarked />, label: 'Memory', detail: run.input.detail };
    case 'agent':
      return { icon: <Bot />, label: 'Agent', detail: run.input.description };
    case 'todo':
      return { icon: <Wrench />, label: 'Updated the todos' };
    case 'ask':
      return { icon: <MessageCircleQuestion />, label: 'Asked', detail: run.input.questions.map((question) => question.prompt).join(' ') };
    case 'plan':
      return { icon: <Wrench />, label: 'Planned' };
    case 'other':
      return { icon: <Wrench />, label: run.input.title, detail: run.input.detail };
  }
}
