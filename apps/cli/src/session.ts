import type { NoticeTone, Status, TodoGroup } from '@jinion/tui';
import type { AgentEvent, AgentResume, BackgroundTask, ToolRun, Usage } from './agent/types.js';

export type Entry =
  | { id: string; kind: 'banner' }
  /**
   * `prompt` is what the agent got, when pasted text made it longer than what is shown. `steered` messages were sent
   * into a turn in progress. `promptId` is what the agent calls the message, for going back to before it.
   */
  | { id: string; kind: 'user'; text: string; prompt?: string; steered?: boolean; promptId?: string }
  /** From the first of its text to when anything else followed it or the turn ended; older sessions have neither. */
  | { id: string; kind: 'thinking'; text: string; startedAt?: number; endedAt?: number }
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'notice'; text: string; tone: NoticeTone }
  /** The conversation was compacted to free context: how much it had and has, and what the agent carries on from. */
  | { id: string; kind: 'compaction'; trigger: 'manual' | 'auto'; before: number; after?: number; summary?: string }
  /** A background task that ended, with what the agent said about it. */
  | { id: string; kind: 'task'; task: BackgroundTask; summary?: string }
  /** The files a turn changed, at its end; `turn` is the message whose turn view in `/diff` has them. */
  | { id: string; kind: 'changes'; turn: string; files: ChangedFile[] }
  /** `children` are the tool calls of the subagent an `agent` call runs. */
  | {
      id: string;
      kind: 'tool';
      run: ToolRun;
      status: Status;
      output: string[];
      startedAt: number;
      endedAt?: number;
      children?: ToolCallEntry[];
      /** Waiting for the user to allow it, and when they did: a command's time runs from then. */
      waiting?: boolean;
      approvedAt?: number;
    };

type ToolEntry = Extract<Entry, { kind: 'tool' }>;

/** A file the agent changed in a turn, and by how many lines. */
export interface ChangedFile {
  path: string;
  created: boolean;
  added: number;
  removed: number;
}

/** A subagent's tool call. */
export interface ToolCallEntry {
  id: string;
  run: ToolRun;
  status: Status;
  startedAt: number;
  endedAt?: number;
}

export interface Session {
  id: string;
  createdAt: number;
  entries: Entry[];
  todos: TodoGroup[];
  usage: Usage;
  title?: string;
  /**
   * When the title was last chosen, by the agent from the conversation or by the user, who then keeps it; `turns` is
   * how many prompts the conversation had then.
   */
  titled?: { by: 'agent' | 'user'; turns: number; at: number };
  busySince?: number;
  /** Where the turn in progress begins in `entries`: what comes from there on stays open until it ends. */
  turnFrom?: number;
  /** The agent is summarizing the conversation. */
  compacting?: boolean;
  /** The agent's own id for this conversation, used to continue it after `/resume`. */
  agentSession?: string;
}

/** What a session store keeps of a conversation. */
export type SavedSession = Omit<Session, 'busySince' | 'turnFrom' | 'compacting' | 'title'> & { title: string; updatedAt: number };

export type Action =
  | { type: 'submit'; text: string; prompt?: string }
  /** The agent started a turn itself, e.g. to look at a background task that ended. */
  | { type: 'agent-turn' }
  /** The tool call `id` waits for the user's permission, or got it. */
  | { type: 'approval'; id: string; waiting: boolean }
  /** A message added to the turn in progress; `id` is what the agent calls it. */
  | { type: 'steer'; text: string; prompt?: string; id?: string }
  /** A new title for the conversation `session`, which may have been switched away from meanwhile. */
  | { type: 'retitle'; session: string; title: string; by: 'agent' | 'user'; turns: number }
  /** The conversation went back to before this user entry, which leaves it with everything after it. */
  | { type: 'rewind'; entry: string }
  | { type: 'event'; event: AgentEvent }
  | { type: 'finish'; outcome: 'done' | 'interrupted' | 'failed'; message?: string }
  | { type: 'notice'; text: string; tone?: NoticeTone }
  | { type: 'clear' }
  | { type: 'load'; session: SavedSession };

let sequence = 0;
/** Saved sessions come back in later runs, so ids carry a per-run prefix to stay unique next to their entries. */
const run = Math.random().toString(36).slice(2, 8);
export const nextId = () => `${run}${++sequence}`;

export function createSession(contextWindow: number): Session {
  return {
    id: `session_${Date.now().toString(36)}_${nextId()}`,
    createdAt: Date.now(),
    entries: [{ id: nextId(), kind: 'banner' }],
    todos: [],
    usage: { contextTokens: 0, contextWindow, cost: 0 },
  };
}

function titleOf(text: string) {
  const line = text.trim().split('\n')[0] ?? '';
  return line.length > 60 ? `${line.slice(0, 59)}…` : line;
}

export const firstPrompt = (session: Pick<Session, 'entries'>) =>
  session.entries.find((entry) => entry.kind === 'user')?.text;

/** `undefined` when nothing was asked yet, so empty sessions are not kept. */
export function toSaved(session: Session): SavedSession | undefined {
  const prompt = firstPrompt(session);
  if (prompt === undefined) return undefined;
  const { busySince: _, turnFrom: __, compacting: ___, title, ...rest } = session;
  return { ...rest, title: title ?? prompt, updatedAt: Date.now() };
}

export function fromSaved(saved: SavedSession): Session {
  const { updatedAt: _, ...session } = saved;
  return session;
}

/** What the agent needs to continue a saved conversation, if it can. */
export const resumeOf = (saved: SavedSession): AgentResume | undefined =>
  saved.agentSession ? { sessionId: saved.agentSession, cost: saved.usage.cost } : undefined;

const notice = (text: string, tone: NoticeTone): Entry => ({ id: nextId(), kind: 'notice', text, tone });

export function reduce(session: Session, action: Action): Session {
  return endThinking(session, next(session, action));
}

/** Thinking is over once anything follows it, or the turn ends. */
function endThinking(before: Session, after: Session): Session {
  const open = before.entries.at(-1);
  if (open?.kind !== 'thinking' || open.endedAt !== undefined) return after;
  const index = after.entries.findIndex((entry) => entry.id === open.id);
  if (index === -1 || (index === after.entries.length - 1 && after.busySince !== undefined)) return after;
  const entries = after.entries.map((entry, at) => (at === index ? { ...entry, endedAt: Date.now() } : entry));
  return { ...after, entries };
}

function next(session: Session, action: Action): Session {
  switch (action.type) {
    case 'submit':
      return {
        ...session,
        entries: [...session.entries, { id: nextId(), kind: 'user', text: action.text, prompt: action.prompt }],
        // A first title from what the user typed, until the agent names the conversation.
        title: session.title ?? titleOf(action.text),
        busySince: Date.now(),
        turnFrom: session.entries.length,
      };
    case 'agent-turn':
      return { ...session, busySince: Date.now(), turnFrom: session.entries.length };
    case 'retitle':
      if (action.session !== session.id) return session;
      return { ...session, title: action.title, titled: { by: action.by, turns: action.turns, at: Date.now() } };
    case 'steer':
      return {
        ...session,
        entries: [
          ...session.entries,
          { id: nextId(), kind: 'user', text: action.text, prompt: action.prompt, steered: true, promptId: action.id },
        ],
      };
    case 'event':
      return apply(session, action.event);
    case 'approval':
      return updateTool(session, action.id, ({ waiting: _, ...entry }) =>
        action.waiting ? { ...entry, waiting: true } : { ...entry, approvedAt: Date.now() },
      );
    case 'finish': {
      const cancel = <T extends { status: Status; endedAt?: number }>(call: T): T =>
        call.status === 'running' ? { ...call, status: 'cancelled', endedAt: Date.now() } : call;
      // A subagent sent to the background goes on after the turn, and its calls with it.
      const entries: Entry[] = session.entries.map((entry) =>
        entry.kind !== 'tool'
          ? entry
          : { ...cancel(entry), children: isBackground(entry) ? entry.children : entry.children?.map(cancel) },
      );
      const changes = turnChanges(entries, session.turnFrom ?? entries.length);
      if (changes) entries.push(changes);
      if (action.outcome === 'interrupted') entries.push(notice('Interrupted. Tell jinion what to do instead.', 'warning'));
      if (action.outcome === 'failed') entries.push(notice(action.message ?? 'Something went wrong.', 'error'));
      return { ...session, entries, busySince: undefined, turnFrom: undefined, compacting: undefined };
    }
    case 'notice':
      return { ...session, entries: [...session.entries, notice(action.text, action.tone ?? 'muted')] };
    case 'clear':
      return createSession(session.usage.contextWindow);
    case 'load':
      return fromSaved(action.session);
    case 'rewind': {
      const index = session.entries.findIndex((entry) => entry.id === action.entry);
      if (index === -1) return session;
      const entries = session.entries.slice(0, index);
      // The task list goes back to what the last update before that message showed.
      const todos = entries.findLast((entry) => entry.kind === 'tool' && entry.run.name === 'todo');
      return { ...session, entries, todos: todos?.kind === 'tool' && todos.run.name === 'todo' ? todos.run.input.groups : [] };
    }
  }
}

function apply(session: Session, event: AgentEvent): Session {
  switch (event.type) {
    case 'thinking':
    case 'text': {
      const last = session.entries.at(-1);
      if (last?.kind === event.type) {
        return { ...session, entries: [...session.entries.slice(0, -1), { ...last, text: last.text + event.delta }] };
      }
      const text = event.delta.trimStart();
      const entry: Entry =
        event.type === 'thinking' ? { id: nextId(), kind: 'thinking', text, startedAt: Date.now() } : { id: nextId(), kind: 'text', text };
      return { ...session, entries: [...session.entries, entry] };
    }
    case 'tool-start': {
      if (event.parent) {
        const child: ToolCallEntry = { id: event.id, run: event.call, status: 'running', startedAt: Date.now() };
        return updateTool(session, event.parent, (entry) => ({ ...entry, children: [...(entry.children ?? []), child] }));
      }
      const entry: Entry = {
        id: event.id,
        kind: 'tool',
        run: event.call,
        status: 'running',
        output: [],
        startedAt: Date.now(),
      };
      if (event.call.name !== 'todo') return { ...session, entries: [...session.entries, entry] };
      // Consecutive todo updates replace each other instead of stacking up.
      const last = session.entries.at(-1);
      const kept = last?.kind === 'tool' && last.run.name === 'todo' ? session.entries.slice(0, -1) : session.entries;
      return { ...session, entries: [...kept, entry], todos: event.call.input.groups };
    }
    case 'tool-output':
      return updateTool(session, event.id, (entry) => ({ ...entry, output: [...entry.output, ...event.lines] }));
    case 'tool-end': {
      const end = <T extends { run: ToolRun }>(call: T): T => ({
        ...call,
        run: { ...call.run, result: event.result } as ToolRun,
        status: event.ok ? 'done' : 'error',
        endedAt: Date.now(),
      });
      const { parent } = event;
      if (!parent) return updateTool(session, event.id, end);
      return updateTool(session, parent, (entry) => ({
        ...entry,
        children: entry.children?.map((child) => (child.id === event.id ? end(child) : child)),
      }));
    }
    case 'usage':
      return { ...session, usage: event.usage };
    case 'session':
      return { ...session, agentSession: event.id };
    case 'sent': {
      // The prompt that started the turn is the newest message the agent hasn't named yet.
      const index = session.entries.findLastIndex((entry) => entry.kind === 'user' && !entry.promptId);
      if (index === -1) return session;
      const entries = session.entries.map((entry, at) => (at === index ? { ...entry, promptId: event.id } : entry));
      return { ...session, entries };
    }
    case 'compaction': {
      if (event.state === 'running') return { ...session, compacting: true };
      if (event.state === 'failed') {
        return { ...session, compacting: undefined, entries: [...session.entries, notice(`Couldn't compact the conversation: ${event.error}`, 'error')] };
      }
      const { trigger, before, after, summary } = event;
      return { ...session, compacting: undefined, entries: [...session.entries, { id: nextId(), kind: 'compaction', trigger, before, after, summary }] };
    }
    case 'task-end':
      return { ...session, entries: [...session.entries, { id: nextId(), kind: 'task', task: event.task, summary: event.summary }] };
    case 'limits':
    case 'mode':
    case 'commands':
    case 'tasks':
    case 'turn-start':
      // Kept by the app: they belong to the account or the agent's process and outlive the conversation on screen.
      return session;
  }
}

/** Whether the entry at `index` came in the turn still running, which keeps a command's output open until it ends. */
export const inRunningTurn = (session: Pick<Session, 'busySince' | 'turnFrom'>, index: number) =>
  session.busySince !== undefined && index >= (session.turnFrom ?? 0);

/** The prompts the user sent, not counting messages that joined a running turn. */
export const promptCount = (entries: Entry[]) => entries.filter((entry) => entry.kind === 'user' && !entry.steered).length;

/** How long a title lasts, at most, while the conversation goes on. */
const RETITLE_AFTER_MS = 20 * 60_000;

/**
 * Whether the conversation is due for a new title: after its first prompt, then each time its prompts double, since a
 * conversation settles on what it is about as it goes, or after a while with new prompts. A title the user chose stays.
 */
export function titleDue(session: Pick<Session, 'entries' | 'titled'>, now = Date.now()) {
  const turns = promptCount(session.entries);
  const { titled } = session;
  if (turns === 0 || titled?.by === 'user') return false;
  if (!titled) return true;
  return turns >= titled.turns * 2 || (turns > titled.turns && now - titled.at >= RETITLE_AFTER_MS);
}

const clip = (text: string, length: number) => {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > length ? `${line.slice(0, length - 1)}…` : line;
};

/**
 * What a small model needs to name the conversation: how it began, where it is now and what changed, in a few thousand
 * characters at most.
 */
export function conversationDigest(entries: Entry[]) {
  const prompts = entries.flatMap((entry) => (entry.kind === 'user' ? [entry.prompt ?? entry.text] : []));
  const reply = entries.findLast((entry) => entry.kind === 'text');
  const plan = entries.findLast((entry) => entry.kind === 'tool' && entry.run.name === 'plan');
  const changed = [...new Set(editTurns(entries).flatMap((turn) => turn.edits.map((change) => change.path)))];
  return [
    prompts[0] && `First message: ${clip(prompts[0], 400)}`,
    ...prompts.slice(Math.max(1, prompts.length - 5)).map((prompt) => `Later message: ${clip(prompt, 300)}`),
    plan?.kind === 'tool' && plan.run.name === 'plan' && `Plan: ${clip(plan.run.input.plan, 400)}`,
    changed.length > 0 && `Files changed: ${changed.slice(0, 10).join(', ')}`,
    reply?.kind === 'text' && `Agent's latest reply: ${clip(reply.text, 500)}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** The files the agent changed in a turn, from its edits rather than from git, for `/diff`'s turn views. */
export interface EditTurn {
  /** The id of the message that started the turn. */
  id: string;
  /** What it said. */
  prompt: string;
  /** In the order they were made, subagents' included; a file changed twice has two. */
  edits: { path: string; patch: string; created?: boolean }[];
}

/**
 * The turns in which the agent changed files, newest first. A message that joined a running turn belongs to it; a call
 * that failed or was cancelled changed nothing.
 */
export function editTurns(entries: Entry[]): EditTurn[] {
  const turns: EditTurn[] = [];
  for (const entry of entries) {
    if (entry.kind === 'user' && !entry.steered) turns.push({ id: entry.id, prompt: entry.text, edits: [] });
    turns.at(-1)?.edits.push(...edits(entry));
  }
  return turns.filter((turn) => turn.edits.length > 0).reverse();
}

/** The edits a tool call and a subagent's calls under it went through with. */
function edits(entry: Entry): EditTurn['edits'] {
  if (entry.kind !== 'tool') return [];
  return [entry, ...(entry.children ?? [])].flatMap((call) =>
    call.run.name === 'edit' && call.status === 'done'
      ? [{ path: call.run.input.path, patch: call.run.result?.patch ?? call.run.input.patch, created: call.run.input.created }]
      : [],
  );
}

/** Each file in `edits` once, in the order first changed, with its patches together and the lines they add and remove. */
export function changedFiles(list: EditTurn['edits']): (ChangedFile & { patch: string })[] {
  const files = new Map<string, { patches: string[]; created: boolean }>();
  for (const edit of list) {
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

/**
 * What the turn that began at `from` changed, for the card at its end; `undefined` when it changed nothing. A turn the
 * agent started itself shows in `/diff` with the message before it, as its edits do.
 */
function turnChanges(entries: Entry[], from: number): Entry | undefined {
  const files = changedFiles(entries.slice(from).flatMap(edits)).map(({ patch: _, ...file }) => file);
  const turn = entries.slice(0, from + 1).findLast((entry) => entry.kind === 'user' && !entry.steered);
  if (files.length === 0 || !turn) return undefined;
  return { id: nextId(), kind: 'changes', turn: turn.id, files };
}

/** A command or subagent call that went on as a background task. */
export const isBackground = (entry: ToolEntry) =>
  (entry.run.name === 'bash' || entry.run.name === 'agent') && entry.run.result?.background !== undefined;

function updateTool(session: Session, id: string, update: (entry: ToolEntry) => Entry): Session {
  return {
    ...session,
    entries: session.entries.map((entry) => (entry.kind === 'tool' && entry.id === id ? update(entry) : entry)),
  };
}
