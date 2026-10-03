import { randomUUID } from 'node:crypto';
import { getSessionMessages, type EffortLevel, type query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { ModelOption, ModelSelection } from '@jinion/tui/chat';
import type { DebugLog } from '../../lib/debug.js';
import { errorMessage } from '../../lib/errors.js';
import type { McpConfig } from '../../mcp/config.js';
import type { MemoryStore } from '../../memory/store.js';
import type { Agent, AgentCommand, AgentMode, AgentPrompt, FileChanges, RewindScope, RunContext } from '../agent.js';
import type { AgentEvent } from '../events.js';
import type { AgentMcp } from '../mcp.js';
import { ClaudeAccounts } from './agent-accounts.js';
import { ClaudeApprovals } from './approvals.js';
import { toAgentCommands, toClaudeContent, type Invocations } from './commands.js';
import { readHistory } from './history.js';
import { claudeMcp } from './mcp.js';
import { claudeOptions } from './options.js';
import { askRules, PERMISSION_MODES } from './policy.js';
import { type ClaudeResume, ClaudeProcess, errorOf } from './process.js';
import { followTranscript } from './session-files.js';
import { claudeTitle } from './title.js';
import { claudeUsage, toContextUsage } from './usage.js';

export interface ClaudeAgentOptions {
  cwd: string;
  selection?: ModelSelection;
  mode?: AgentMode;
  account?: string;
  memory?: MemoryStore;
  mcp?: McpConfig;
  debug?: DebugLog;
  spawn?: typeof query;
  sessionMessages?: typeof getSessionMessages;
}

export class ClaudeAgent implements Agent {
  readonly name = 'Claude';
  readonly modes: AgentMode[] = ['manual', 'edits', 'plan', 'auto'];
  readonly accounts: ClaudeAccounts;
  readonly mcp?: AgentMcp;
  private current: ModelSelection;
  private currentMode: AgentMode;
  private modelList?: Promise<ModelOption[]>;
  private claude?: ClaudeProcess;
  private resume?: ClaudeResume;
  private cwd: string;
  private turn?: RunContext;
  /** Claude Code only reads MCP servers when it starts, so the next turn starts a new process. */
  private stale = false;
  private invocations: Invocations = new Map();
  private readonly approvals: ClaudeApprovals;
  private readonly listeners = new Set<(event: AgentEvent) => void>();

  constructor(private readonly options: ClaudeAgentOptions) {
    this.current = options.selection ?? { model: 'opus' };
    this.cwd = options.cwd;
    this.currentMode = options.mode ?? 'edits';

    this.accounts = new ClaudeAccounts({
      account: options.account,
      running: () => this.running().query,
      onSwitch: () => {
        this.modelList = undefined;
        this.restart();
      },
    });

    this.approvals = new ClaudeApprovals({
      project: options.cwd,
      cwd: () => this.cwd,
      turn: () => this.turn,
      onPlanApproved: async (mode) => {
        this.currentMode = mode;
        await this.claude?.query.applyFlagSettings({ permissions: { ask: askRules(mode) } });
      },
    });

    if (options.mcp) {
      this.mcp = claudeMcp(options.mcp, () => this.running().query, () => {
        this.stale = true;
      });
    }
  }

  get selection() {
    return this.current;
  }

  get mode() {
    return this.currentMode;
  }

  subscribe(listener: (event: AgentEvent) => void) {
    this.listeners.add(listener);

    return () => void this.listeners.delete(listener);
  }

  steer(prompt: AgentPrompt) {
    return this.turn ? this.claude?.steer(toClaudeContent(prompt, this.invocations)) : undefined;
  }

  async rewindPreview(id: string): Promise<FileChanges | undefined> {
    const preview = await this.running().query.rewindFiles(id, { dryRun: true });
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

    const read = this.options.sessionMessages ?? getSessionMessages;
    const transcript = await read(resume.sessionId, { dir: this.cwd });
    const index = transcript.findIndex((message) => message.uuid === id);
    if (index === -1) throw new Error("That message isn't in the transcript of this conversation.");

    const before = transcript[index - 1]?.uuid;

    this.drop(before ? { ...resume, at: before } : undefined);
  }

  async commands(): Promise<AgentCommand[]> {
    const { commands, invocations } = toAgentCommands(await this.running().query.supportedCommands());

    this.invocations = invocations;

    return commands;
  }

  async setMode(mode: AgentMode) {
    this.currentMode = mode;
    const running = this.claude?.query;
    if (!running) return;

    await running.setPermissionMode(PERMISSION_MODES[mode]);
    await running.applyFlagSettings({ permissions: { ask: askRules(mode) } });
  }

  models() {
    this.modelList ??= (async () => {
      const models = await this.running().query.supportedModels();

      return models.map((model) => ({
        id: model.value,
        name: model.displayName,
        description: model.description,
        efforts: model.supportedEffortLevels ?? [],
      }));
    })().catch((error: unknown) => {
      this.modelList = undefined;

      throw error;
    });

    return this.modelList;
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
    yield* this.follow(claude, context, claude.send(toClaudeContent(prompt, this.invocations), id));
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

  titleFor(digest: string, current?: string) {
    return claudeTitle({ digest, current, cwd: this.options.cwd, account: this.accounts.current, spawn: this.options.spawn });
  }

  async context() {
    return toContextUsage(await this.running().query.getContextUsage({ detail: 'full' }));
  }

  usage({ drivers = false } = {}) {
    return claudeUsage(this.running().query, drivers);
  }

  history(progress?: (done: number, total: number) => void) {
    return readHistory(progress);
  }

  reset(resume?: ClaudeResume, cwd?: string) {
    this.cwd = cwd ?? this.options.cwd;
    this.drop(resume);
  }

  close() {
    this.drop();
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
      this.options.debug?.write('error', { message: errorMessage(error), aborted: context.signal.aborted });

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

  /** Changed MCP servers restart it only while no background task runs, since those end with the process. */
  private running() {
    if (this.stale && !this.turn && !this.claude?.events.tasks.running) {
      this.stale = false;
      this.restart();
    }

    this.claude ??= this.start();

    return this.claude;
  }

  private restart() {
    this.drop(this.claude ? this.resumeOf(this.claude) : this.resume);
  }

  /** Falls back to what the process itself continued, which a process that never took a turn would otherwise lose. */
  private resumeOf(claude: ClaudeProcess): ClaudeResume | undefined {
    const { sessionId, cost } = claude.events;

    return sessionId ? { sessionId, cost } : claude.resumed;
  }

  private start() {
    const { memory, mcp, debug, spawn } = this.options;
    const { cwd, resume } = this;

    this.resume = undefined;
    if (resume) followTranscript(resume.sessionId, cwd);

    const options = claudeOptions({
      cwd,
      project: this.options.cwd,
      selection: this.current,
      mode: this.currentMode,
      account: this.accounts.current,
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
      account: this.accounts.current,
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

      this.invocations = invocations;
      yield { type: 'commands', commands };

      return;
    }

    yield* claude.events.map(message);
  }
}
