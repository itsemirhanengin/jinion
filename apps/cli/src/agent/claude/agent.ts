import { randomUUID } from 'node:crypto';
import {
  query,
  type CanUseTool,
  type EffortLevel,
  type HookCallback,
  type PermissionMode,
  type Query,
  type SDKMessage,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { ModelOption, ModelSelection } from '@jinion/tui';
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
import { accountEnv, accountNames, accountStatus, checkName, DEFAULT_ACCOUNT, planName, signIn } from './accounts.js';
import { ClaudeEvents, toClaudeAnswers, toQuestions, type ClaudeQuestion } from './events.js';
import { guardReason } from './guard.js';
import { serverInfos, toAgentCommands, toClaudeServer } from './mcp.js';
import { isMemoryTool, MEMORY_SERVER, memoryServer } from './memory.js';
import type { McpConfig } from '../../mcp/config.js';
import type { MemoryStore } from '../../memory/store.js';
import { alwaysRules, formatRule, ProjectPermissions, toPermissionRequest } from './permissions.js';
import { CLAUDE_CODE_SKILLS, claudePlugins, skillPlugins } from './plugins.js';
import { systemPrompt } from './prompt.js';

const TOOLS = [
  'Read',
  'Edit',
  'Write',
  'Bash',
  'Glob',
  'Grep',
  'Agent',
  'TaskCreate',
  'TaskUpdate',
  'TaskList',
  'TaskGet',
  'AskUserQuestion',
  'WebFetch',
  'WebSearch',
  'ExitPlanMode',
  'Skill',
  // MCP tools are listed by name only until ToolSearch loads them, so many servers cost little context.
  'ToolSearch',
  'ListMcpResourcesTool',
  'ReadMcpResourceTool',
];

/** Claude Code's permission mode for each of Jinion's modes. */
export const PERMISSION_MODES: Record<AgentMode, PermissionMode> = {
  manual: 'default',
  edits: 'acceptEdits',
  plan: 'plan',
  auto: 'auto',
};

/** Runs without asking. Edits inside the project are allowed by `acceptEdits`; anything else asks the user. */
const ALLOWED = [
  'Bash(git status*)',
  'Bash(git diff*)',
  'Bash(git log*)',
  'Bash(git show*)',
  'Bash(git branch*)',
  'Bash(ls*)',
  'Bash(pwd)',
  'Bash(pnpm typecheck*)',
  'Bash(pnpm build*)',
  'Bash(pnpm test*)',
  'Bash(pnpm lint*)',
  'Bash(pnpm run *)',
  'Bash(npm test*)',
  'Bash(npm run *)',
];

/**
 * `acceptEdits` would also run these filesystem commands without asking; ask rules make them ask every time. Auto
 * mode leaves them to its classifier instead, which knows when a removal throws work away.
 */
const ASK = ['Bash(rm *)', 'Bash(rmdir *)', 'Bash(mv *)', 'Bash(cp *)', 'Bash(sed *)'];

const askRules = (mode: AgentMode) => (mode === 'edits' ? ASK : []);

/** `$design` or `$vercel:nextjs`, at the start or after whitespace, without trailing punctuation. */
const MENTIONED = /(?<=^|\s)\$([\w.:-]*[\w-])/g;

/**
 * Tools that never ask: they only read, or load skills and tools the user installed. They are allowed in
 * `canUseTool`, since bare allow rules would bypass it.
 */
const UNASKED = new Set(['WebFetch', 'WebSearch', 'Skill', 'ToolSearch', 'ListMcpResourcesTool', 'ReadMcpResourceTool']);

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
}

interface Conversation {
  query: Query;
  input: Inbox<SDKUserMessage>;
  output: AsyncIterator<SDKMessage>;
  events: ClaudeEvents;
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
  private conversation?: Conversation;
  /** The conversation the next process continues. */
  private resume?: AgentResume;
  private turn?: RunContext;
  /** The MCP servers changed; Claude Code only reads them when it starts, so the next turn starts a new process. */
  private stale = false;
  /** What Claude Code calls each skill and MCP prompt the user mentions, e.g. `user:design` for `$design`. */
  private invocations = new Map<string, string>();
  private stderr = '';
  private readonly permissions: ProjectPermissions;
  /** Whole tools the user allowed. They are checked here, since bare allow rules would bypass `canUseTool`. */
  private readonly allowedTools = new Set<string>();

  constructor(private readonly options: ClaudeAgentOptions) {
    this.current = options.selection ?? { model: 'opus' };
    this.currentMode = options.mode ?? 'edits';
    this.account = options.account && accountNames().includes(options.account) ? options.account : DEFAULT_ACCOUNT;
    this.permissions = new ProjectPermissions(options.cwd);
    const config = options.mcp;
    if (config) {
      this.mcp = {
        servers: async () => serverInfos(await this.process().query.mcpServerStatus(), config),
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

  /** Asks the running Claude Code who it is signed in as; the process it starts takes the next prompt. */
  private activeAccount() {
    const name = this.account;
    this.accountInfo ??= (async () => {
      const info = await this.process().query.accountInfo();
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

  /** The running Claude Code, started when there is none or when it runs with MCP servers that changed since. */
  private process() {
    if (this.stale && !this.turn) {
      this.stale = false;
      this.restart();
    }
    return (this.conversation ??= this.start());
  }

  /** Ends the process; the next one continues the same conversation. */
  private restart() {
    const events = this.conversation?.events;
    this.reset(events?.sessionId ? { sessionId: events.sessionId, cost: events.cost } : this.resume);
  }

  /** Asks Claude Code, which also knows the skills, commands and prompts of plugins and MCP servers. */
  async commands(): Promise<AgentCommand[]> {
    const { commands, invocations } = toAgentCommands(await this.process().query.supportedCommands());
    this.invocations = invocations;
    return commands;
  }

  async setMode(mode: AgentMode) {
    this.currentMode = mode;
    const running = this.conversation?.query;
    if (!running) return;
    await running.setPermissionMode(PERMISSION_MODES[mode]);
    await running.applyFlagSettings({ permissions: { ask: askRules(mode) } });
  }

  /** Asks Claude Code, which knows what the account can use. The process it starts takes the next prompt. */
  models() {
    this.modelList ??= (async () => {
      const models = await this.process().query.supportedModels();
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
    const running = this.conversation?.query;
    if (!running) return;
    if (selection.model !== previous.model) await running.setModel(selection.model);
    if (selection.effort !== previous.effort) {
      await running.applyFlagSettings({ effortLevel: (selection.effort as EffortLevel | undefined) ?? null });
    }
  }

  async *run(prompt: string, context: RunContext): AsyncGenerator<AgentEvent> {
    const conversation = this.process();
    this.turn = context;
    const interrupt = () => void conversation.query.interrupt().catch(() => {});
    context.signal.addEventListener('abort', interrupt, { once: true });

    try {
      const uuid = randomUUID();
      conversation.input.push({
        type: 'user',
        uuid,
        message: { role: 'user', content: this.invocation(prompt) },
        parent_tool_use_id: null,
        origin: { kind: 'human' },
      });

      while (true) {
        const next = await conversation.output.next();
        if (next.done) throw new Error(this.exitMessage());
        const message = next.value;
        yield* conversation.events.map(message);
        if (message.type !== 'result' || !answers(message, uuid)) continue;

        context.signal.throwIfAborted();
        if (message.is_error) throw new TurnFailed(errorOf(message));
        return;
      }
    } catch (error) {
      // A process that died can't take another turn; the next prompt continues the conversation in a new one.
      if (!context.signal.aborted && !(error instanceof TurnFailed)) {
        const { sessionId, cost } = conversation.events;
        this.reset(sessionId ? { sessionId, cost } : undefined);
      }
      throw error;
    } finally {
      context.signal.removeEventListener('abort', interrupt);
      this.turn = undefined;
    }
  }

  /**
   * Claude Code runs a skill or an MCP prompt only as a slash command at the start of the prompt. A prompt that starts
   * with its only skill goes as that command, `$design brief` as `/user:design brief`, and an MCP prompt moves to the
   * front wherever it is. Other skills stay where the user put them, with a note to load them with the Skill tool.
   */
  private invocation(prompt: string) {
    const mentioned = [...prompt.matchAll(MENTIONED)].flatMap((match) => {
      const target = this.invocations.get(match[1]!);
      return target ? [{ name: match[1]!, target, index: match.index, length: match[0].length }] : [];
    });
    if (mentioned.length === 0) return prompt;
    const without = (mention: (typeof mentioned)[number]) =>
      `${prompt.slice(0, mention.index)}${prompt.slice(mention.index + mention.length)}`.replace(/\s+/g, ' ').trim();

    const mcp = mentioned.find((mention) => mention.target.startsWith('mcp__'));
    const skills = mentioned.filter((mention) => !mention.target.startsWith('mcp__'));
    if (!mcp && skills.length === 1 && skills[0]!.index === 0) return `/${skills[0]!.target}${prompt.slice(skills[0]!.length)}`;

    const text = mcp ? `/${mcp.target} ${without(mcp)}`.trimEnd() : prompt;
    if (skills.length === 0) return text;
    const list = skills.map((skill) => `$${skill.name} is ${skill.target}`).join(', ');
    return `${text}\n\n<system-reminder>The user picked skills for this request with $: ${list}. Load each with the Skill tool before you start.</system-reminder>`;
  }

  reset(resume?: AgentResume) {
    this.resume = resume;
    if (!this.conversation) return;
    this.conversation.input.close();
    this.conversation.query.close();
    this.conversation = undefined;
  }

  close() {
    this.reset();
  }

  private start(): Conversation {
    const { cwd } = this.options;
    const { model, effort } = this.current;
    const mode = this.currentMode;
    const resume = this.resume;
    this.resume = undefined;
    // Forced colors would put escape codes into command output the model reads.
    const { FORCE_COLOR: _, ...env } = process.env;
    const input = new Inbox<SDKUserMessage>();
    this.stderr = '';
    const saved = this.permissions.list();
    for (const rule of saved) if (!rule.includes('(')) this.allowedTools.add(rule);
    const { memory, mcp } = this.options;
    const servers = (mcp?.servers() ?? []).filter((server) => mcp!.isEnabled(server));
    const disabled = mcp?.disabled() ?? [];
    const conversation = query({
      prompt: input,
      options: {
        cwd,
        model,
        effort: effort as EffortLevel | undefined,
        resume: resume?.sessionId,
        // Not snapshotted, so a resumed conversation sees the notes saved since it began.
        systemPrompt: { type: 'custom', prompt: systemPrompt(cwd, memory), snapshot: false },
        // Claude Code's own settings, CLAUDE.md files and memory stay out. Jinion passes the MCP servers configured in
        // files itself; Claude Code adds the account's claude.ai connectors and the plugins' servers.
        settingSources: [],
        mcpServers: {
          ...Object.fromEntries(servers.map((server) => [server.name, toClaudeServer(server.transport)])),
          ...(memory && { [MEMORY_SERVER]: memoryServer(memory) }),
        },
        // Turns off, by name, the servers Claude Code finds itself. Only an admin's policy could turn them back on.
        managedSettings: disabled.length > 0 ? { deniedMcpServers: disabled.map((serverName) => ({ serverName })) } : undefined,
        plugins: [...skillPlugins(cwd), ...claudePlugins(cwd)],
        settings: {
          // Plugins' hooks would add context of their own to every conversation. Jinion's hooks below still run.
          disableAllHooks: true,
          disableBundledSkills: true,
          skillOverrides: Object.fromEntries(CLAUDE_CODE_SKILLS.map((name) => [name, 'off' as const])),
          permissions: { ask: askRules(mode) },
        },
        tools: TOOLS,
        allowedTools: [...ALLOWED, ...saved.filter((rule) => rule.includes('('))],
        permissionMode: PERMISSION_MODES[mode],
        canUseTool: this.canUseTool,
        hooks: { PreToolUse: [{ hooks: [this.guard] }] },
        includePartialMessages: true,
        // Background tasks finish after the turn and start turns of their own, which Jinion can't follow yet.
        env: { ...env, ...accountEnv(this.account), CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1' },
        stderr: (data) => {
          this.stderr = (this.stderr + data).slice(-2000);
        },
      },
    });
    // Claude Code omits thinking text by default; Jinion shows a summary of it.
    conversation.setMaxThinkingTokens(null, 'summarized').catch(() => {});
    return {
      query: conversation,
      input,
      output: conversation[Symbol.asyncIterator](),
      events: new ClaudeEvents(cwd, resume?.cost),
    };
  }

  /** Runs before Claude Code's own checks, so what Jinion always asks about is asked in every mode. */
  private readonly guard: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse') return {};
    // Jinion's own memory tools run without asking, and an allow rule for them would print a warning over the UI.
    if (isMemoryTool(input.tool_name)) {
      return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', permissionDecisionReason: 'Jinion memory' } };
    }
    const reason = guardReason(input.tool_name, (input.tool_input ?? {}) as Record<string, unknown>, this.options.cwd);
    if (!reason) return {};
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } };
  };

  private readonly canUseTool: CanUseTool = async (name, input, options) => {
    if (UNASKED.has(name) || this.allowedTools.has(name)) return { behavior: 'allow', updatedInput: input };
    const turn = this.turn;
    if (!turn) return { behavior: 'deny', message: 'Nobody is there to approve this right now.' };

    if (name === 'AskUserQuestion') {
      const questions = (input.questions ?? []) as ClaudeQuestion[];
      try {
        const answers = await turn.ask(toQuestions(questions));
        return { behavior: 'allow', updatedInput: { ...input, ...toClaudeAnswers(questions, answers) } };
      } catch {
        return { behavior: 'deny', message: 'The user dismissed the question.', interrupt: true };
      }
    }

    if (name === 'ExitPlanMode') {
      // Approval moves the session to the mode the user picked; "keep planning" sends the note back to the model.
      let decision;
      try {
        decision = await turn.approvePlan(['auto', 'edits', 'manual']);
      } catch {
        return { behavior: 'deny', message: 'The user stopped the turn.', interrupt: true };
      }
      if (!decision.approve) {
        return { behavior: 'deny', message: `The user wants to keep planning${decision.note ? `: ${decision.note}` : '.'}` };
      }
      this.currentMode = decision.mode;
      await this.conversation?.query.applyFlagSettings({ permissions: { ask: askRules(decision.mode) } });
      return {
        behavior: 'allow',
        updatedInput: input,
        updatedPermissions: [{ type: 'setMode', mode: PERMISSION_MODES[decision.mode], destination: 'session' }],
      };
    }

    const rules = alwaysRules(options);
    let decision;
    try {
      decision = await turn.approve(toPermissionRequest(name, input, options, rules));
    } catch {
      return { behavior: 'deny', message: 'The user stopped the turn.', interrupt: true };
    }

    if (!decision.allow) {
      return {
        behavior: 'deny',
        message: decision.note
          ? `The user said no: ${decision.note}`
          : "The user said no. Don't try to get around it; ask what to do instead if it's still needed.",
        decisionClassification: 'user_reject',
      };
    }
    if (!decision.always || rules.length === 0) {
      return { behavior: 'allow', updatedInput: input, decisionClassification: 'user_temporary' };
    }

    // Jinion keeps "don't ask again" itself; Claude Code only remembers it for this conversation.
    this.permissions.add(rules.map(formatRule));
    for (const rule of rules) if (!rule.ruleContent) this.allowedTools.add(rule.toolName);
    return {
      behavior: 'allow',
      updatedInput: input,
      updatedPermissions: (options.suggestions ?? []).map((update) => ({ ...update, destination: 'session' as const })),
      decisionClassification: 'user_permanent',
    };
  };

  private exitMessage() {
    const detail = this.stderr.trim().split('\n').slice(-5).join('\n');
    return detail ? `Claude Code exited:\n${detail}` : 'Claude Code exited unexpectedly.';
  }
}

/** Claude Code reported an error for the turn, e.g. a rate limit; the process can still take the next one. */
class TurnFailed extends Error {}

/** Whether `result` ends the turn started by the prompt with this uuid. */
function answers(result: Extract<SDKMessage, { type: 'result' }>, uuid: string) {
  const ids = result.user_message_uuids ?? (result.user_message_uuid ? [result.user_message_uuid] : undefined);
  return !ids || ids.includes(uuid);
}

function errorOf(result: Extract<SDKMessage, { type: 'result' }>) {
  if (result.subtype === 'success') return result.result || 'Claude Code reported an error.';
  return result.errors.join('\n') || `Claude Code stopped: ${result.subtype}.`;
}


/** A queue of prompts that Claude Code reads for as long as the conversation lasts. */
class Inbox<T> implements AsyncIterable<T> {
  private readonly items: T[] = [];
  private wake?: () => void;
  private closed = false;

  push(item: T) {
    this.items.push(item);
    this.wake?.();
  }

  close() {
    this.closed = true;
    this.wake?.();
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      const item = this.items.shift();
      if (item !== undefined) {
        yield item;
        continue;
      }
      if (this.closed) return;
      await new Promise<void>((resolve) => (this.wake = resolve));
      this.wake = undefined;
    }
  }
}
