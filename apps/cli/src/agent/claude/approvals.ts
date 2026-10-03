import type { CanUseTool, HookCallback, PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import type { PermissionDecision } from '@jinion/tui/chat';
import type { AgentMode, PlanDecision, RunContext } from '../agent.js';
import { guardReason, readsRepositories } from './guard.js';
import type { Input } from './input.js';
import { isMemoryTool } from './memory.js';
import { alwaysRules, formatRule, ProjectPermissions, toPermissionRequest } from './permissions.js';
import { PERMISSION_MODES } from './policy.js';
import { type ClaudeQuestion, toClaudeAnswers, toQuestions } from './questions.js';

/** They only read, or load what the user installed. */
const UNASKED = new Set(['WebFetch', 'WebSearch', 'Skill', 'ToolSearch', 'ListMcpResourcesTool', 'ReadMcpResourceTool']);

export interface ApprovalsOptions {
  cwd: string;
  turn(): RunContext | undefined;
  onPlanApproved(mode: AgentMode): Promise<void>;
}

export class ClaudeApprovals {
  private readonly permissions: ProjectPermissions;
  /** Checked here, since bare allow rules would bypass `canUseTool`. */
  private readonly allowedTools = new Set<string>();

  constructor(private readonly options: ApprovalsOptions) {
    this.permissions = new ProjectPermissions(options.cwd);
  }

  savedRules() {
    const saved = this.permissions.list();

    for (const rule of saved) if (!rule.includes('(')) this.allowedTools.add(rule);

    return saved.filter((rule) => rule.includes('('));
  }

  /** Runs before Claude Code's own checks, so what Jinion always asks about is asked in every mode. */
  readonly guard: HookCallback = async (input) => {
    if (input.hook_event_name !== 'PreToolUse') return {};

    // Jinion's own memory tools run without asking, and an allow rule for them would print a warning over the UI.
    if (isMemoryTool(input.tool_name)) {
      return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow', permissionDecisionReason: 'Jinion memory' } };
    }

    const reason = guardReason(input.tool_name, (input.tool_input ?? {}) as Input, this.options.cwd);
    if (!reason) return {};

    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } };
  };

  readonly canUseTool: CanUseTool = async (name, input, options) => {
    if (UNASKED.has(name) || this.allowedTools.has(name) || readsRepositories(name, input)) return { behavior: 'allow', updatedInput: input };

    const turn = this.options.turn();
    if (!turn) return { behavior: 'deny', message: 'Nobody is there to approve this right now.' };

    if (name === 'AskUserQuestion') return this.ask(turn, input);
    if (name === 'ExitPlanMode') return this.approvePlan(turn, input);

    return this.approve(turn, name, input, options);
  };

  private async ask(turn: RunContext, input: Input): Promise<PermissionResult> {
    const questions = (input.questions ?? []) as ClaudeQuestion[];

    try {
      const answers = await turn.ask(toQuestions(questions));

      return { behavior: 'allow', updatedInput: { ...input, ...toClaudeAnswers(questions, answers) } };
    } catch {
      return { behavior: 'deny', message: 'The user dismissed the question.', interrupt: true };
    }
  }

  private async approvePlan(turn: RunContext, input: Input): Promise<PermissionResult> {
    let decision: PlanDecision;

    try {
      decision = await turn.approvePlan(['auto', 'edits', 'manual']);
    } catch {
      return { behavior: 'deny', message: 'The user stopped the turn.', interrupt: true };
    }

    if (!decision.approve) {
      return { behavior: 'deny', message: `The user wants to keep planning${decision.note ? `: ${decision.note}` : '.'}` };
    }

    await this.options.onPlanApproved(decision.mode);

    return {
      behavior: 'allow',
      updatedInput: input,
      updatedPermissions: [{ type: 'setMode', mode: PERMISSION_MODES[decision.mode], destination: 'session' }],
    };
  }

  private async approve(turn: RunContext, name: string, input: Input, options: Parameters<CanUseTool>[2]): Promise<PermissionResult> {
    const rules = alwaysRules(options);
    let decision: PermissionDecision;

    try {
      decision = await turn.approve(toPermissionRequest(name, input, options, rules), options.toolUseID);
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
  }
}
