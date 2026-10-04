import { randomUUID } from 'node:crypto';
import type { DebugLog } from '../../lib/debug.js';
import { errorMessage } from '../../lib/errors.js';
import { Inbox } from '../../lib/inbox.js';
import type { MemoryStore } from '../../memory/store.js';
import type { AgentMode, AgentPrompt, AgentSession, RewindScope, RunContext } from '../agent.js';
import type { AgentEvent } from '../events.js';
import type { ModelSelection } from '../models.js';
import type { ContextUsage } from '../usage.js';
import { answer } from './approvals.js';
import type { CodexConnection } from './connection.js';
import { CodexEvents, DEFAULT_CONTEXT_WINDOW } from './events.js';
import { developerInstructions, memoryToolSpecs } from './memory.js';
import { modeSettings } from './modes.js';
import { changesFrom, previewOf, restore } from './rewind.js';
import type { Notification, SandboxPolicy, ServerRequest, ThreadStarted, Turn, UserInput } from './protocol.js';

/** What a session takes from the backend it belongs to. */
export interface CodexHost {
  connect(): CodexConnection;
  readonly options: { memory?: MemoryStore; debug?: DebugLog };
  /** A skill's file by its name, for the skills a prompt mentions with `$`. */
  skillPath(name: string): string | undefined;
  closed(session: CodexSession): void;
}

export interface CodexSessionOptions {
  cwd: string;
  selection: ModelSelection;
  mode: AgentMode;
  /** The thread to carry on. */
  resume?: string;
}

interface RunningTurn {
  context: RunContext;
  inbox: Inbox<Notification | Error>;
  /** Known once Codex answers `turn/start`, or says the turn started. */
  id?: string;
}

const IMPLEMENT = 'Implement the plan.';

/** Codex's own default, until a thread says how the user's config resolved it. */
const DEFAULT_WORKSPACE: SandboxPolicy = { type: 'workspaceWrite', writableRoots: [], networkAccess: false, excludeTmpdirEnvVar: false, excludeSlashTmp: false };

/** One Codex thread, in the backend's one app-server, which starts as the conversation's first prompt is sent. */
export class CodexSession implements AgentSession {
  /** Switching within a turn is a Codex feature still under development (step_model_switching). */
  readonly modelPerTurn = true;
  private current: ModelSelection;
  private currentMode: AgentMode;
  private cwd: string;
  private thread?: string;
  private resume?: string;
  private turn?: RunningTurn;
  /** The project's sandbox as Codex resolved it, which every mode but manual writes in. */
  private workspace: SandboxPolicy = DEFAULT_WORKSPACE;
  private readonly events = new CodexEvents(() => this.thread);
  private readonly listeners = new Set<(event: AgentEvent) => void>();
  private usage?: { contextTokens: number; contextWindow: number };

  constructor(
    private readonly host: CodexHost,
    options: CodexSessionOptions,
  ) {
    this.current = options.selection;
    this.currentMode = options.mode;
    this.cwd = options.cwd;
    this.resume = options.resume;
  }

  get selection() {
    return this.current;
  }

  get mode() {
    return this.currentMode;
  }

  /** Its thread once it started, which the backend asks about on its behalf, e.g. for MCP servers. */
  get threadId() {
    return this.thread;
  }

  get working() {
    return this.turn !== undefined;
  }

  async select(selection: ModelSelection) {
    this.current = selection;
  }

  /**
   * In the running turn only who answers its approvals changes, as Auto comes or goes; the sandbox and plan mode
   * follow from the next turn, since Codex sets them as a turn starts.
   */
  async setMode(mode: AgentMode) {
    this.currentMode = mode;
    await this.changeRunningTurn({ approvalsReviewer: modeSettings(mode, this.current, this.workspace).approvalsReviewer });
  }

  subscribe(listener: (event: AgentEvent) => void) {
    this.listeners.add(listener);

    return () => void this.listeners.delete(listener);
  }

  run(prompt: AgentPrompt, context: RunContext): AsyncIterable<AgentEvent> {
    return this.follow(context, async (threadId) => this.startTurn(threadId, this.input(prompt)));
  }

  steer(prompt: AgentPrompt) {
    const { thread, turn } = this;
    if (!thread || !turn?.id) return undefined;

    this.request('turn/steer', { threadId: thread, input: this.input(prompt), expectedTurnId: turn.id }).catch((error: unknown) =>
      this.host.options.debug?.write('error', { message: `Couldn't steer: ${errorMessage(error)}` }),
    );

    return randomUUID();
  }

  compact(_focus: string | undefined, context: RunContext): AsyncIterable<AgentEvent> {
    // Codex's compaction takes no focus; it runs as a turn of its own, whose id comes with `turn/started`.
    return this.follow(context, async (threadId) => {
      this.events.compacting = true;
      await this.request('thread/compact/start', { threadId });

      return undefined;
    });
  }

  async rewindPreview(id: string) {
    const changes = changesFrom(await this.turns(), id);

    return changes && previewOf(changes);
  }

  /** Codex takes the conversation back; the files are put back here, from the patches its history holds. */
  async rewind(id: string, { code, conversation }: RewindScope) {
    const threadId = await this.ensureThread();

    if (code) {
      const changes = changesFrom(await this.turns(), id);
      if (!changes) throw new Error("That message isn't in this conversation's history");

      restore(changes);
    }

    if (conversation) await this.request('thread/revert', { threadId, beforeTurnId: id });
  }

  async context(): Promise<ContextUsage> {
    const used = this.usage?.contextTokens ?? 0;
    const window = this.usage?.contextWindow ?? DEFAULT_CONTEXT_WINDOW;

    return {
      used,
      window,
      categories: [
        { name: 'Conversation', tokens: used, kind: 'used' },
        { name: 'Free space', tokens: Math.max(0, window - used), kind: 'free' },
      ],
    };
  }

  /** From the next turn on, which Codex runs in the new folder. */
  moveTo(cwd: string) {
    this.cwd = cwd;
  }

  async stopTask(id: string) {
    const processId = this.events.tasks.stop(id);

    if (processId && this.thread) await this.request('thread/backgroundTerminals/terminate', { threadId: this.thread, processId });
  }

  /** Background tasks stop with it, as they do with Claude's process. */
  close() {
    const { thread } = this;

    this.turn?.inbox.push(new Error('The conversation was closed.'));

    if (thread) {
      void this.request('thread/backgroundTerminals/clean', { threadId: thread })
        .then(() => this.request('thread/unsubscribe', { threadId: thread }))
        .catch(() => {});
    }

    this.stopTasks();
    this.host.closed(this);
  }

  /** Whether a notification about `threadId` is this conversation's. */
  owns(threadId: string) {
    return this.events.owns(threadId);
  }

  /** What Codex says about this conversation: the running turn follows it, and between turns listeners hear it. */
  receive(notification: Notification) {
    if (this.turn) return this.turn.inbox.push(notification);

    for (const event of this.events.map(notification)) this.emit(event);
  }

  /** What the backend learned for every conversation, such as the skills changing. */
  announce(event: AgentEvent) {
    this.emit(event);
  }

  /** What Codex asks during this conversation's turn. */
  answer(request: ServerRequest) {
    return answer(request, {
      turn: () => this.turn?.context,
      edits: (item) => this.events.edits(item),
      steer: (note) => this.steer({ text: note }),
      memory: this.host.options.memory,
    });
  }

  /** Codex stopped: a turn in progress fails, and the next one starts the thread again in a new app-server. */
  lost(error: Error) {
    this.resume = this.thread ?? this.resume;
    this.thread = undefined;
    this.turn?.inbox.push(error);
    this.stopTasks();
  }

  /** A turn that ended meanwhile has nothing to change; the next one starts with the setting anyway. */
  private async changeRunningTurn(settings: object) {
    const { thread, turn } = this;
    if (!thread || !turn?.id) return;

    await this.request('turn/settings/update', { threadId: thread, turnId: turn.id, ...settings }).catch((error: unknown) =>
      this.host.options.debug?.write('error', { message: `Couldn't change the running turn: ${errorMessage(error)}` }),
    );
  }

  private stopTasks() {
    const stopped = this.events.tasks.stopAll();

    if (stopped) this.emit(stopped);
  }

  /**
   * Follows a turn from the moment it is asked for until Codex says it ended. A plan written in plan mode goes to the
   * user once its turn ends; an approved one is carried out in a turn that follows on its own, within the same run.
   */
  private async *follow(context: RunContext, start: (threadId: string) => Promise<string | undefined>): AsyncGenerator<AgentEvent> {
    const started = !this.thread;
    const threadId = await this.ensureThread();

    if (started) yield { type: 'session', id: threadId };

    let next: ((threadId: string) => Promise<string | undefined>) | undefined = start;

    while (next) {
      yield* this.followTurn(threadId, context, next);
      next = undefined;

      const plan = this.events.plan;

      this.events.plan = undefined;
      if (this.currentMode !== 'plan' || plan === undefined) break;

      const decision = await context.approvePlan(['auto', 'edits', 'manual']);

      if (decision.approve) {
        this.currentMode = decision.mode;
        yield { type: 'mode', mode: decision.mode };
        next = (id) => this.startTurn(id, [text(IMPLEMENT)]);
      } else if (decision.note) {
        const { note } = decision;

        next = (id) => this.startTurn(id, [text(note)]);
      }
    }
  }

  private async *followTurn(threadId: string, context: RunContext, start: (threadId: string) => Promise<string | undefined>): AsyncGenerator<AgentEvent> {
    const turn: RunningTurn = { context, inbox: new Inbox() };

    const interrupt = () => {
      if (turn.id) void this.request('turn/interrupt', { threadId, turnId: turn.id }).catch(() => {});
    };

    this.turn = turn;
    context.signal.addEventListener('abort', interrupt, { once: true });

    try {
      turn.id = await start(threadId);
      if (turn.id) yield { type: 'sent', id: turn.id };
      if (context.signal.aborted) interrupt();

      let ended: Turn | undefined;

      for await (const notification of turn.inbox) {
        if (notification instanceof Error) throw notification;

        if (notification.method === 'turn/started' && notification.params.threadId === threadId && !turn.id) {
          turn.id = notification.params.turn.id;
          if (context.signal.aborted) interrupt();
        }

        if (notification.method === 'turn/completed' && notification.params.threadId === threadId && notification.params.turn.id === turn.id) {
          ended = notification.params.turn;
          break;
        }

        for (const event of this.events.map(notification)) {
          if (event.type === 'usage') this.usage = event.usage;
          yield event;
        }
      }

      yield* this.events.turnEnded(ended?.status === 'completed' && !context.signal.aborted);
      context.signal.throwIfAborted();
      if (ended?.status === 'failed') throw new Error(ended.error?.message ?? 'Codex stopped with an error.');
      if (ended?.status === 'interrupted') throw new Error('Codex stopped the turn.');
    } finally {
      context.signal.removeEventListener('abort', interrupt);
      this.events.compacting = false;
      if (this.turn === turn) this.turn = undefined;
    }
  }

  /** Every turn says how Codex acts, since what one sets holds for those after it. */
  private async startTurn(threadId: string, input: UserInput[]) {
    const { turn } = await this.request<{ turn: Turn }>('turn/start', {
      threadId,
      input,
      cwd: this.cwd,
      model: this.current.model,
      effort: this.current.effort ?? null,
      // Jinion shows a summary of the model's reasoning, as it does Claude's.
      summary: 'auto',
      ...modeSettings(this.currentMode, this.current, this.workspace),
    });

    return turn.id;
  }

  private async ensureThread() {
    if (this.thread) return this.thread;

    const { memory } = this.host.options;
    const { approvalPolicy, approvalsReviewer } = modeSettings(this.currentMode, this.current, this.workspace);

    const settings = {
      cwd: this.cwd,
      model: this.current.model,
      approvalPolicy,
      approvalsReviewer,
      sandbox: 'workspace-write',
      developerInstructions: developerInstructions(memory),
      // Codex reads AGENTS.md; Jinion reads CLAUDE.md too, so a project with only that one gets it here as well.
      config: { project_doc_fallback_filenames: ['CLAUDE.md'] },
    };

    const { thread, sandbox } = this.resume
      ? await this.request<ThreadStarted>('thread/resume', { ...settings, threadId: this.resume, excludeTurns: true })
      : await this.request<ThreadStarted>('thread/start', {
          ...settings,
          dynamicTools: memory ? memoryToolSpecs(memory) : undefined,
          // Only a paginated history can be taken back to before a turn, as `/rewind` does.
          historyMode: 'paginated',
        });

    this.resume = undefined;
    this.thread = thread.id;
    if (sandbox.type === 'workspaceWrite') this.workspace = sandbox;

    return thread.id;
  }

  /** Every turn of the thread, oldest first, with what happened in each. */
  private async turns() {
    const threadId = await this.ensureThread();

    return this.host.connect().all<Turn>('thread/turns/list', { threadId, itemsView: 'full', sortDirection: 'asc' });
  }

  /** Skills the prompt mentions with `$` go along as Codex's skill inputs, as Codex's own composer sends them. */
  private input({ text: prompt, images = [] }: AgentPrompt): UserInput[] {
    const skills = [...prompt.matchAll(MENTIONED)].flatMap(([, name = '']) => {
      const path = this.host.skillPath(name);

      return path ? [{ type: 'skill' as const, name, path }] : [];
    });

    return [text(prompt), ...images.map((image) => ({ type: 'image' as const, url: `data:${image.mediaType};base64,${image.data}` })), ...skills];
  }

  private request<T>(method: string, params: unknown) {
    return this.host.connect().request<T>(method, params);
  }

  private emit(event: AgentEvent) {
    if (event.type === 'usage') this.usage = event.usage;
    for (const listener of this.listeners) listener(event);
  }
}

const MENTIONED = /(?<=^|\s)\$([\w.:-]*[\w-])/g;

const text = (value: string): UserInput => ({ type: 'text', text: value, text_elements: [] });
