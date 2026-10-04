import type { DebugLog } from '../../lib/debug.js';
import type { MemoryStore } from '../../memory/store.js';
import type { AgentBackend, AgentCommand, AgentMode, SessionOptions } from '../agent.js';
import type { AgentMcp } from '../mcp.js';
import type { ModelOption } from '../models.js';
import { CodexAccounts } from './accounts.js';
import { CodexConnection, type CodexProcess } from './connection.js';
import { codexHistory } from './history.js';
import { codexMcp } from './mcp.js';
import { type Model, type Notification, type RateLimitSnapshot, type ServerRequest, type SkillMetadata, threadOf } from './protocol.js';
import { CodexSession, type CodexHost } from './session.js';
import { codexTitle } from './title.js';
import { toUsage } from './usage.js';

export interface CodexBackendOptions {
  /** The project. */
  cwd: string;
  /** Jinion's, which Codex is told as it connects. */
  version: string;
  memory?: MemoryStore;
  debug?: DebugLog;
  /** Tests give a fake app-server. */
  start?: () => CodexProcess;
}

/**
 * Codex, through one `codex app-server` that every conversation shares, each as a thread of its own. It starts the
 * first time something asks Codex, and again after it stopped.
 */
export class CodexBackend implements AgentBackend, CodexHost {
  readonly name = 'Codex';
  /** Codex's own default in the pinned version, until the user picks another. */
  readonly defaultModel = 'gpt-6.1-sol';
  readonly modes: AgentMode[] = ['manual', 'edits', 'plan', 'auto'];
  readonly accounts: CodexAccounts;
  readonly mcp: AgentMcp;
  private connection?: CodexConnection;
  /** The most recently opened last. */
  private readonly sessions: CodexSession[] = [];
  private skills = new Map<string, string>();

  constructor(readonly options: CodexBackendOptions) {
    this.accounts = new CodexAccounts(() => this.connect());
    this.mcp = codexMcp(() => this.connect(), () => this.sessions.findLast((session) => session.threadId)?.threadId);
  }

  connect() {
    if (this.connection) return this.connection;

    const { start, debug, version } = this.options;
    const connection = new CodexConnection({ start, debug, version });

    connection.onNotification((notification) => this.route(notification));
    connection.onRequest((request) => this.answer(request));

    connection.onExit((error) => {
      if (this.connection !== connection) return;

      this.connection = undefined;
      debug?.write('error', { message: error.message });
      for (const session of this.sessions) session.lost(error);
    });

    this.connection = connection;

    return connection;
  }

  session({ cwd, selection, mode, resume }: SessionOptions = {}) {
    const session = new CodexSession(this, {
      cwd: cwd ?? this.options.cwd,
      selection: selection ?? { model: this.defaultModel },
      mode: mode ?? 'edits',
      resume: resume?.sessionId,
    });

    this.sessions.push(session);

    return session;
  }

  async models(): Promise<ModelOption[]> {
    const models = await this.connect().all<Model>('model/list', {});

    return models
      .filter((model) => !model.hidden)
      .map((model) => ({
        id: model.id,
        name: model.displayName,
        description: model.description,
        efforts: model.supportedReasoningEfforts.map((effort) => effort.reasoningEffort),
      }));
  }

  async commands(): Promise<AgentCommand[]> {
    const { data } = await this.connect().request<{ data: { skills: SkillMetadata[] }[] }>('skills/list', { cwds: [this.options.cwd] });
    const skills = (data[0]?.skills ?? []).filter((skill) => skill.enabled);

    this.skills = new Map(skills.map((skill) => [skill.name, skill.path]));

    return skills.map((skill) => ({
      name: skill.name,
      description: skill.shortDescription ?? skill.description,
      source: 'skill',
      group: skill.pluginId ? skill.pluginId.split('@')[0]! : skill.scope === 'repo' ? 'project' : skill.scope,
    }));
  }

  titleFor(digest: string, current?: string) {
    return codexTitle(this.connect(), { digest, current, cwd: this.options.cwd });
  }

  async usage() {
    const { rateLimits } = await this.connect().request<{ rateLimits: RateLimitSnapshot }>('account/rateLimits/read', {});

    return toUsage(rateLimits);
  }

  /** Models show by their names, as in `/model`. */
  async history(progress?: (done: number, total: number) => void) {
    const names = new Map((await this.models().catch(() => [])).map((model) => [model.id, model.name]));

    return codexHistory(this.connect(), names, progress);
  }

  skillPath(name: string) {
    return this.skills.get(name);
  }

  closed(session: CodexSession) {
    const index = this.sessions.indexOf(session);

    if (index !== -1) this.sessions.splice(index, 1);
  }

  close() {
    for (const session of [...this.sessions]) session.close();
    this.connection?.close();
    this.connection = undefined;
  }

  /** To the conversation it is about; what is about the account, to those running a turn, or else the newest. */
  private route(notification: Notification) {
    if (notification.method === 'skills/changed') return void this.reloadSkills();

    const thread = threadOf(notification);

    if (thread !== undefined) return this.sessions.find((session) => session.owns(thread))?.receive(notification);

    const working = this.sessions.filter((session) => session.working);

    for (const session of working.length > 0 ? working : this.sessions.slice(-1)) session.receive(notification);
  }

  private answer(request: ServerRequest) {
    const session = this.sessions.find((candidate) => candidate.owns(request.params.threadId));
    if (!session) throw new Error(`Jinion has no conversation ${request.params.threadId}.`);

    return session.answer(request);
  }

  private async reloadSkills() {
    try {
      const commands = await this.commands();

      for (const session of this.sessions) session.announce({ type: 'commands', commands });
    } catch {
      // The skills stay as they were; the next change tries again.
    }
  }
}
