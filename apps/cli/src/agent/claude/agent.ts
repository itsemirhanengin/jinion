import type { EffortLevel, query, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { ModelOption, ModelSelection } from '@jinion/tui';
import type { DebugLog } from '../../debug.js';
import type { McpConfig } from '../../mcp/config.js';
import type { MemoryStore } from '../../memory/store.js';
import type {
  Agent,
  AgentAccount,
  AgentAccounts,
  AgentCommand,
  AgentEvent,
  AgentMcp,
  AgentMode,
  AgentResume,
  RunContext,
  SignInOptions,
} from '../types.js';
import { accountNames, accountStatus, checkName, DEFAULT_ACCOUNT, planName, signIn } from './accounts.js';
import { ClaudeApprovals } from './approvals.js';
import { toAgentCommands, toClaudePrompt, type Invocations } from './commands.js';
import { serverInfos } from './mcp.js';
import { askRules, claudeOptions, PERMISSION_MODES } from './options.js';
import { ClaudeProcess, errorOf } from './process.js';

export interface ClaudeAgentOptions {
  cwd: string;
  /** A Claude Code model alias or id, such as `opus` or `sonnet`, and optionally an effort level. Opus by default. */
  selection?: ModelSelection;
  /** `edits` by default. */
  mode?: AgentMode;
  /** The account to sign in with, `default` (Claude Code's own login) when left out or unknown. */
  account?: string;
  /** Notes the agent reads and keeps across conversations. */
  memory?: MemoryStore;
  /** The MCP servers configured in files, and which are off. */
  mcp?: McpConfig;
  /** Records what goes to Claude Code and what comes back, for `--debug`. */
  debug?: DebugLog;
  /** Starts Claude Code: the SDK's `query`, or a stand-in in tests. */
  spawn?: typeof query;
}

/** Drives Claude Code headless, with Jinion's system prompt and project instructions instead of Claude Code's own. */
export class ClaudeAgent implements Agent {
  readonly name = 'Claude';
  readonly modes: AgentMode[] = ['manual', 'edits', 'plan', 'auto'];
  readonly mcp?: AgentMcp;
  private current: ModelSelection;
  private currentMode: AgentMode;
  private account: string;
  private modelList?: Promise<ModelOption[]>;
  private accountInfo?: Promise<AgentAccount>;
  private claude?: ClaudeProcess;
  /** The conversation the next process continues. */
  private resume?: AgentResume;
  private turn?: RunContext;
  /** The MCP servers changed; Claude Code only reads them when it starts, so the next turn starts a new process. */
  private stale = false;
  private invocations: Invocations = new Map();
  private readonly approvals: ClaudeApprovals;
  private readonly listeners = new Set<(event: AgentEvent) => void>();

  constructor(private readonly options: ClaudeAgentOptions) {
    this.current = options.selection ?? { model: 'opus' };
    this.currentMode = options.mode ?? 'edits';
    this.account = options.account && accountNames().includes(options.account) ? options.account : DEFAULT_ACCOUNT;
    this.approvals = new ClaudeApprovals({
      cwd: options.cwd,
      turn: () => this.turn,
      onPlanApproved: async (mode) => {
        this.currentMode = mode;
        await this.claude?.query.applyFlagSettings({ permissions: { ask: askRules(mode) } });
      },
    });
    const config = options.mcp;
    if (config) {
      this.mcp = {
        servers: async () => serverInfos(await this.running().query.mcpServerStatus(), config),
        setEnabled: async (changes) => {
          const servers = config.servers();
          for (const [name, enabled] of Object.entries(changes)) {
            config.setEnabled(servers.find((server) => server.name === name) ?? { name }, enabled);
          }
          if (Object.keys(changes).length > 0) this.stale = true;
        },
      };
    }
  }

  get selection() {
    return this.current;
  }

  get mode() {
    return this.currentMode;
  }

  readonly accounts: AgentAccounts = ((agent: ClaudeAgent) => ({
    get current() {
      return agent.account;
    },
    active: () => agent.activeAccount(),
    list: () => Promise.all(accountNames().map(accountStatus)),
    use: (name: string) => agent.useAccount(name),
    signIn: (name: string, options: SignInOptions) => {
      const problem = checkName(name);
      return problem ? Promise.reject(new Error(problem)) : signIn(name, options);
    },
  }))(this);

  subscribe(listener: (event: AgentEvent) => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  steer(text: string) {
    return this.turn !== undefined && (this.claude?.steer(toClaudePrompt(text, this.invocations)) ?? false);
  }

  /** Asks the running Claude Code who it is signed in as; the process it starts takes the next prompt. */
  private activeAccount() {
    const name = this.account;
    this.accountInfo ??= (async () => {
      const info = await this.running().query.accountInfo();
      return {
        name,
        signedIn: info.email !== undefined,
        email: info.email,
        plan: planName(info.subscriptionType),
        organization: info.organization,
      };
    })().catch((error: unknown) => {
      this.accountInfo = undefined;
      throw error;
    });
    return this.accountInfo;
  }

  private async useAccount(name: string) {
    if (name === this.account) return;
    if (!accountNames().includes(name)) throw new Error(`There is no account called ${name}.`);
    // The conversation goes on under the new login: its transcript is shared between accounts.
    this.account = name;
    this.modelList = undefined;
    this.accountInfo = undefined;
    this.restart();
  }

  /** Asks Claude Code, which also knows the skills, commands and prompts of plugins and MCP servers. */
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

  /** Asks Claude Code, which knows what the account can use. The process it starts takes the next prompt. */
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

  async *run(prompt: string, context: RunContext): AsyncGenerator<AgentEvent> {
    const claude = this.running();
    this.turn = context;
    const interrupt = () => claude.interrupt();
    context.signal.addEventListener('abort', interrupt, { once: true });
    try {
      let last: SDKMessage | undefined;
      for await (const message of claude.send(toClaudePrompt(prompt, this.invocations))) {
        last = message;
        yield* this.eventsOf(claude, message);
      }
      context.signal.throwIfAborted();
      if (last?.type === 'result' && last.is_error) throw new Error(errorOf(last));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.options.debug?.write('error', { message, aborted: context.signal.aborted });
      throw error;
    } finally {
      context.signal.removeEventListener('abort', interrupt);
      this.turn = undefined;
    }
  }

  reset(resume?: AgentResume) {
    this.resume = resume;
    const claude = this.claude;
    this.claude = undefined;
    claude?.close();
  }

  close() {
    this.reset();
  }

  /** The running Claude Code, started when there is none or when it runs with MCP servers that changed since. */
  private running() {
    if (this.stale && !this.turn) {
      this.stale = false;
      this.restart();
    }
    this.claude ??= this.start();
    return this.claude;
  }

  /** Ends the process; the next one continues the same conversation. */
  private restart() {
    this.reset(this.claude ? this.resumeOf(this.claude) : this.resume);
  }

  private resumeOf(claude: ClaudeProcess): AgentResume | undefined {
    const { sessionId, cost } = claude.events;
    return sessionId ? { sessionId, cost } : this.resume;
  }

  private start() {
    const { cwd, memory, mcp, debug, spawn } = this.options;
    const resume = this.resume;
    this.resume = undefined;
    const options = claudeOptions({
      cwd,
      selection: this.current,
      mode: this.currentMode,
      account: this.account,
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
      account: this.account,
      resume: resume?.sessionId,
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
        for (const event of this.eventsOf(claude, message)) for (const listener of this.listeners) listener(event);
      },
      // A process that died can't take another turn; the next prompt continues the conversation in a new one.
      onExit: () => {
        if (claude === this.claude) this.reset(this.resumeOf(claude));
      },
    });
    // Claude Code omits thinking text by default; Jinion shows a summary of it.
    claude.query.setMaxThinkingTokens(null, 'summarized').catch(() => {});
    return claude;
  }

  /** The events a message maps to; a new list of commands also changes what `$` mentions run. */
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
