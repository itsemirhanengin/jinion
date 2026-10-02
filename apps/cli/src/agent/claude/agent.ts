import { randomUUID } from 'node:crypto';
import {
  query,
  type CanUseTool,
  type EffortLevel,
  type Query,
  type SDKMessage,
  type SDKUserMessage,
} from '@anthropic-ai/claude-agent-sdk';
import type { ModelOption, ModelSelection } from '@jinion/tui';
import type { Agent, AgentCommand, AgentEvent, AgentResume, RunContext } from '../types.js';
import { ClaudeEvents, toClaudeAnswers, toQuestions, type ClaudeQuestion } from './events.js';
import { alwaysRules, formatRule, ProjectPermissions, toPermissionRequest } from './permissions.js';
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
];

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

/** `acceptEdits` would also run these filesystem commands without asking; ask rules make them ask every time. */
const ASK = ['Bash(rm *)', 'Bash(rmdir *)', 'Bash(mv *)', 'Bash(cp *)', 'Bash(sed *)'];

/** Read-only tools that are allowed in `canUseTool`, since bare allow rules would bypass it. */
const READ_ONLY = new Set(['WebFetch', 'WebSearch']);

export interface ClaudeAgentOptions {
  cwd: string;
  /** A Claude Code model alias or id, such as `opus` or `sonnet`, and optionally an effort level. Opus by default. */
  selection?: ModelSelection;
}

interface Conversation {
  query: Query;
  input: Inbox<SDKUserMessage>;
  output: AsyncIterator<SDKMessage>;
  events: ClaudeEvents;
  turns: number;
}

/** Drives Claude Code headless, with Jinion's system prompt and project instructions instead of Claude Code's own. */
export class ClaudeAgent implements Agent {
  readonly name = 'Claude';
  readonly commands: AgentCommand[] = [];
  private current: ModelSelection;
  private modelList?: Promise<ModelOption[]>;
  private conversation?: Conversation;
  /** The conversation the next process continues. */
  private resume?: AgentResume;
  private turn?: RunContext;
  private stderr = '';
  private readonly permissions: ProjectPermissions;
  /** Whole tools the user allowed. They are checked here, since bare allow rules would bypass `canUseTool`. */
  private readonly allowedTools = new Set<string>();

  constructor(private readonly options: ClaudeAgentOptions) {
    this.current = options.selection ?? { model: 'opus' };
    this.permissions = new ProjectPermissions(options.cwd);
  }

  get selection() {
    return this.current;
  }

  /** Asks Claude Code, which knows what the account can use. The process it starts takes the next prompt. */
  models() {
    this.modelList ??= (async () => {
      const conversation = (this.conversation ??= this.start());
      const models = await conversation.query.supportedModels();
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
    const conversation = (this.conversation ??= this.start());
    this.turn = context;
    const interrupt = () => void conversation.query.interrupt().catch(() => {});
    context.signal.addEventListener('abort', interrupt, { once: true });

    try {
      if (conversation.turns++ === 0) yield { type: 'title', title: titleOf(prompt) };
      const uuid = randomUUID();
      conversation.input.push({
        type: 'user',
        uuid,
        message: { role: 'user', content: prompt },
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
    const resume = this.resume;
    this.resume = undefined;
    // Forced colors would put escape codes into command output the model reads.
    const { FORCE_COLOR: _, ...env } = process.env;
    const input = new Inbox<SDKUserMessage>();
    this.stderr = '';
    const saved = this.permissions.list();
    for (const rule of saved) if (!rule.includes('(')) this.allowedTools.add(rule);
    const conversation = query({
      prompt: input,
      options: {
        cwd,
        model,
        effort: effort as EffortLevel | undefined,
        resume: resume?.sessionId,
        systemPrompt: systemPrompt(cwd),
        // Claude Code's own settings, CLAUDE.md files, memory, MCP servers and claude.ai connectors stay out.
        settingSources: [],
        strictMcpConfig: true,
        settings: { disableClaudeAiConnectors: true, permissions: { ask: ASK } },
        tools: TOOLS,
        allowedTools: [...ALLOWED, ...saved.filter((rule) => rule.includes('('))],
        permissionMode: 'acceptEdits',
        canUseTool: this.canUseTool,
        includePartialMessages: true,
        // Background tasks finish after the turn and start turns of their own, which Jinion can't follow yet.
        env: { ...env, CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1' },
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
      // A resumed conversation already has its title.
      turns: resume ? 1 : 0,
    };
  }

  private readonly canUseTool: CanUseTool = async (name, input, options) => {
    if (READ_ONLY.has(name) || this.allowedTools.has(name)) return { behavior: 'allow', updatedInput: input };
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

function titleOf(prompt: string) {
  const line = prompt.trim().split('\n')[0] ?? '';
  return line.length > 60 ? `${line.slice(0, 59)}…` : line;
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
