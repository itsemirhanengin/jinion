import type { getSessionMessages, query } from '@anthropic-ai/claude-agent-sdk';
import type { ModelOption } from '../models.js';
import type { DebugLog } from '../../lib/debug.js';
import type { McpConfig } from '../../mcp/config.js';
import type { MemoryStore } from '../../memory/store.js';
import type { AgentBackend, AgentCommand, AgentMode, SessionOptions } from '../agent.js';
import type { AgentMcp } from '../mcp.js';
import { ClaudeAccounts } from './agent-accounts.js';
import { toAgentCommands, type Invocations } from './commands.js';
import { readHistory } from './history.js';
import { claudeMcp } from './mcp.js';
import { type ClaudeHost, ClaudeSession } from './session.js';
import { claudeTitle } from './title.js';
import { claudeUsage } from './usage.js';

export interface ClaudeBackendOptions {
  /** The project. */
  cwd: string;
  account?: string;
  memory?: MemoryStore;
  mcp?: McpConfig;
  debug?: DebugLog;
  spawn?: typeof query;
  sessionMessages?: typeof getSessionMessages;
  /** Fetches the account's claude.ai skills for the next process; tests leave it out. */
  syncSkills?: (account: string) => void;
}

/** Claude Code, headless. What sessions share comes through the process of one of them, rather than one of its own. */
export class ClaudeBackend implements AgentBackend, ClaudeHost {
  readonly name = 'Claude';
  readonly defaultModel = 'opus';
  readonly modes: AgentMode[] = ['manual', 'edits', 'plan', 'auto'];
  readonly accounts: ClaudeAccounts;
  readonly mcp?: AgentMcp;
  invocations: Invocations = new Map();
  private modelList?: Promise<ModelOption[]>;
  /** The most recently opened last. */
  private readonly sessions: ClaudeSession[] = [];
  private readonly synced = new Set<string>();

  constructor(readonly options: ClaudeBackendOptions) {
    this.accounts = new ClaudeAccounts({
      account: options.account,
      running: () => this.query(),
      onSwitch: () => {
        this.modelList = undefined;
        for (const session of this.sessions) session.restart();
      },
    });

    if (options.mcp) {
      this.mcp = claudeMcp(options.mcp, () => this.query(), () => {
        for (const session of this.sessions) session.markStale();
      });
    }
  }

  get account() {
    return this.accounts.current;
  }

  session({ cwd, selection, mode, resume }: SessionOptions = {}) {
    const session = new ClaudeSession(this, {
      cwd: cwd ?? this.options.cwd,
      selection: selection ?? { model: this.defaultModel },
      mode: mode ?? 'edits',
      resume,
    });

    this.sessions.push(session);

    return session;
  }

  models() {
    this.modelList ??= (async () => {
      const models = await this.query().supportedModels();

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

  async commands(): Promise<AgentCommand[]> {
    const { commands, invocations } = toAgentCommands(await this.query().supportedCommands());

    this.invocations = invocations;

    return commands;
  }

  titleFor(digest: string, current?: string) {
    return claudeTitle({ digest, current, cwd: this.options.cwd, account: this.account, spawn: this.options.spawn });
  }

  usage({ drivers = false } = {}) {
    return claudeUsage(this.query(), drivers);
  }

  history(progress?: (done: number, total: number) => void) {
    return readHistory(progress);
  }

  close() {
    for (const session of [...this.sessions]) session.close();
  }

  starting() {
    const { account } = this;
    if (!this.options.syncSkills || this.synced.has(account)) return;

    this.synced.add(account);
    this.options.syncSkills(account);
  }

  closed(session: ClaudeSession) {
    const index = this.sessions.indexOf(session);

    if (index !== -1) this.sessions.splice(index, 1);
  }

  /**
   * A session whose process runs, or else the newest one, which then starts its process. With none, as when every
   * conversation is on another backend, one of its own asks.
   */
  private query() {
    const session = this.sessions.findLast((candidate) => candidate.live) ?? this.sessions.at(-1) ?? this.session();

    return session.query();
  }
}
