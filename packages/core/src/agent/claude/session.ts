import { randomUUID } from 'node:crypto';
import { getSessionMessages, type EffortLevel, type query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { ModelSelection } from '../models.js';
import type { DebugLog } from '../../lib/debug.js';
import { errorMessage } from '../../lib/errors.js';
import type { McpConfig } from '../../mcp/config.js';
import type { MemoryStore } from '../../memory/store.js';
import type { AgentMode, AgentPrompt, AgentSession, FileChanges, RewindScope, RunContext } from '../agent.js';
import type { AgentEvent } from '../events.js';
import { ClaudeApprovals } from './approvals.js';
import { toAgentCommands, toClaudeContent, type Invocations } from './commands.js';
import { claudeOptions } from './options.js';
import { askRules, PERMISSION_MODES } from './policy.js';
import { type ClaudeResume, ClaudeProcess, errorOf } from './process.js';
import { followTranscript } from './session-files.js';
import { toContextUsage } from './usage.js';

/** What a session takes from the backend it belongs to. */
export interface ClaudeHost {
  readonly options: {
    /** The project. */
    cwd: string;
    memory?: MemoryStore;
    mcp?: McpConfig;
    debug?: DebugLog;
    spawn?: typeof query;
    sessionMessages?: typeof getSessionMessages;
  };
  readonly account: string;
  /** Skills and MCP prompts by `$name`, the same in every session of the project. */
  invocations: Invocations;
  /** Called as a process starts, e.g. to fetch the account's skills. */
  starting(): void;
  closed(session: ClaudeSession): void;
}

export interface ClaudeSessionOptions {
  cwd: string;
  selection: ModelSelection;
  mode: AgentMode;
  resume?: ClaudeResume;
}

export class ClaudeSession implements AgentSession {
  private current: ModelSelection;
  private currentMode: AgentMode;
  private claude?: ClaudeProcess;
  private resume?: ClaudeResume;
  private cwd: string;
  private turn?: RunContext;
  /** Claude Code reads MCP servers and the login only when it starts, so the next turn starts a new process. */
  private stale = false;
  private readonly approvals: ClaudeApprovals;
  private readonly listeners = new Set<(event: AgentEvent) => void>();

  constructor(
    private readonly host: ClaudeHost,
    options: ClaudeSessionOptions,
  ) {
    this.current = options.selection;
    this.currentMode = options.mode;
    this.cwd = options.cwd;
    this.resume = options.resume;

    this.approvals = new ClaudeApprovals({
      project: host.options.cwd,
      cwd: () => this.cwd,
      turn: () => this.turn,
      onPlanApproved: async (mode) => {
        this.currentMode = mode;
        await this.claude?.query.applyFlagSettings({ permissions: { ask: askRules(mode) } });
      },
    });
  }

  get selection() {
    return this.current;
  }

  get mode() {
    return this.currentMode;
  }

  /** Whether its process runs, so the backend can ask it rather than start another. */
  get live() {
    return this.claude !== undefined;
  }

  subscribe(listener: (event: AgentEvent) => void) {
    this.listeners.add(listener);

    return () => void this.listeners.delete(listener);
  }

  steer(prompt: AgentPrompt) {
    return this.turn ? this.claude?.steer(toClaudeContent(prompt, this.host.invocations)) : undefined;
  }

  async rewindPreview(id: string): Promise<FileChanges | undefined> {
    const preview = await this.query().rewindFiles(id, { dryRun: true });
    if (!preview.canRewind || !preview.filesChanged?.length) return undefined;

    return { files: preview.filesChanged, insertions: preview.insertions ?? 0, deletions: preview.deletions ?? 0 };
  }

  async rewind(id: string, { code, conversation }: RewindScope) {
    const claude = this.running();

    if (code) {
      const result = await claude.query.rewindFiles(id);
      if (!result.canRewind) throw new Error(result.error ?? "The files couldn't be restored.");
    }

    if (!conversation) return;

    const resume = this.resumeOf(claude);
    if (!resume) return this.drop();

    const read = this.host.options.sessionMessages ?? getSessionMessages;
    const transcript = await read(resume.sessionId, { dir: this.cwd });
    const index = transcript.findIndex((message) => message.uuid === id);
    if (index === -1) throw new Error("That message isn't in the transcript of this conversation.");

    const before = transcript[index - 1]?.uuid;

    this.drop(before ? { ...resume, at: before } : undefined);
  }

  async setMode(mode: AgentMode) {
    this.currentMode = mode;
    const running = this.claude?.query;
    if (!running) return;

    await running.setPermissionMode(PERMISSION_MODES[mode]);
    await running.applyFlagSettings({ permissions: { ask: askRules(mode) } });
  }

  async select(selection: ModelSelection) {
    const previous = this.current;

    this.current = selection;
    const running = this.claude?.query;
    if (!running) return;

    if (selection.model !== previous.model) await running.setModel(selection.model);

    if (selection.effort !== previous.effort) {
      await running.applyFlagSettings({ effortLevel: (selection.effort as EffortLevel | undefined) ?? null });
    }
  }

  async *run(prompt: AgentPrompt, context: RunContext): AsyncGenerator<AgentEvent> {
    const claude = this.running();

    this.turn = context;
    const id = randomUUID();

    yield { type: 'sent', id };
    yield* this.follow(claude, context, claude.send(toClaudeContent(prompt, this.host.invocations), id));
  }

  /** Not async, so a message typed right away steers into the turn. */
  join(context: RunContext): AsyncIterable<AgentEvent> {
    const claude = this.claude;
    if (!claude) return (async function* () {})();

    this.turn = context;

    return this.follow(claude, context, claude.follow());
  }

  async stopTask(id: string) {
    await this.claude?.query.stopTask(id);
  }

  async background() {
    return this.claude ? this.claude.query.backgroundTasks() : false;
  }

  compact(focus: string | undefined, context: RunContext): AsyncIterable<AgentEvent> {
    const claude = this.running();

    this.turn = context;

    return this.follow(claude, context, claude.send(focus ? `/compact ${focus}` : '/compact'));
  }

  async context() {
    return toContextUsage(await this.query().getContextUsage({ detail: 'full' }));
  }

  reset(resume?: ClaudeResume, cwd?: string) {
    this.cwd = cwd ?? this.host.options.cwd;
    this.drop(resume);
  }

  close() {
    this.drop();
    this.host.closed(this);
  }

  /** The running process's query, for what the backend asks on behalf of every session. */
  query() {
    return this.running().query;
  }

  /** Picks up what changed outside it, such as MCP servers, at its next turn. */
  markStale() {
    this.stale = true;
  }

  /** Starts over in a new process that carries on the same conversation, such as under another login. */
  restart() {
    this.drop(this.claude ? this.resumeOf(this.claude) : this.resume);
  }

  /** Ends the process; the next prompt continues `resume`, or starts afresh, in the same folder. */
  private drop(resume?: ClaudeResume) {
    this.resume = resume;
    const claude = this.claude;

    this.claude = undefined;
    if (!claude) return;

    claude.close();
    const stopped = claude.events.tasks.stopAll();

    if (stopped) this.emit(stopped);
  }

  private async *follow(claude: ClaudeProcess, context: RunContext, messages: AsyncIterable<SDKMessage>): AsyncGenerator<AgentEvent> {
    const interrupt = () => claude.interrupt();

    context.signal.addEventListener('abort', interrupt, { once: true });

    try {
      let last: SDKMessage | undefined;

      for await (const message of messages) {
        last = message;
        yield* this.eventsOf(claude, message);
      }

      context.signal.throwIfAborted();
      if (last?.type === 'result' && last.is_error) throw new Error(errorOf(last));
    } catch (error) {
      this.host.options.debug?.write('error', { message: errorMessage(error), aborted: context.signal.aborted });

      throw error;
    } finally {
      context.signal.removeEventListener('abort', interrupt);
      this.turn = undefined;
      void this.readCompactAt(claude);
    }
  }

  /** Claude Code's own estimate of where it compacts, which depends on the model; it doesn't ask the model. */
  private async readCompactAt(claude: ClaudeProcess) {
    try {
      const { compactAt } = toContextUsage(await claude.query.getContextUsage({ detail: 'summary' }));
      if (claude !== this.claude) return;

      const usage = claude.events.compactAt(compactAt);

      if (usage) this.emit(usage);
    } catch {
      // A process that just ended, or a Claude Code without it: the warning only comes later.
    }
  }

  private emit(event: AgentEvent) {
    for (const listener of this.listeners) listener(event);
  }

  /** A stale process restarts only while no background task runs, since those end with the process. */
  private running() {
    if (this.stale && !this.turn && !this.claude?.events.tasks.running) {
      this.stale = false;
      this.restart();
    }

    this.claude ??= this.start();

    return this.claude;
  }

  /** Falls back to what the process itself continued, which a process that never took a turn would otherwise lose. */
  private resumeOf(claude: ClaudeProcess): ClaudeResume | undefined {
    const { sessionId, cost } = claude.events;

    return sessionId ? { sessionId, cost } : claude.resumed;
  }

  private start() {
    const { memory, mcp, debug, spawn, cwd: project } = this.host.options;
    const { cwd, resume } = this;

    this.resume = undefined;
    if (resume) followTranscript(resume.sessionId, cwd);
    this.host.starting();

    const options = claudeOptions({
      cwd,
      project,
      selection: this.current,
      mode: this.currentMode,
      account: this.host.account,
      resume,
      memory,
      mcp,
      approvals: this.approvals,
    });

    debug?.write('start', {
      cwd,
      model: options.model,
      effort: options.effort,
      mode: this.currentMode,
      account: this.host.account,
      resume: resume?.sessionId,
      resumeAt: resume?.at,
      servers: Object.keys(options.mcpServers ?? {}),
      disabled: mcp?.disabled() ?? [],
      plugins: options.plugins?.map((plugin) => plugin.path),
    });

    const claude: ClaudeProcess = new ClaudeProcess({
      options,
      cwd,
      resume,
      debug,
      spawn,
      onIdle: (message) => {
        if (claude !== this.claude) return;

        for (const event of this.eventsOf(claude, message)) this.emit(event);
      },
      onTurn: () => {
        if (claude === this.claude) this.emit({ type: 'turn-start' });
      },
      // A process that died can't take another turn; the next prompt continues the conversation in a new one.
      onExit: () => {
        if (claude === this.claude) this.drop(this.resumeOf(claude));
      },
    });

    // Claude Code omits thinking text by default; Jinion shows a summary of it.
    claude.query.setMaxThinkingTokens(null, 'summarized').catch(() => {});

    return claude;
  }

  private *eventsOf(claude: ClaudeProcess, message: SDKMessage): Generator<AgentEvent> {
    if (message.type === 'system' && message.subtype === 'commands_changed') {
      const { commands, invocations } = toAgentCommands(message.commands);

      this.host.invocations = invocations;
      yield { type: 'commands', commands };

      return;
    }

    yield* claude.events.map(message);
  }
}
