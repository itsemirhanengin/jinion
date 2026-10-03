import type { CanUseTool, HookCallback } from '@anthropic-ai/claude-agent-sdk';
import type { PermissionDecision } from '@jinion/tui';
import type { AgentMode, PlanDecision, RunContext } from '../types.js';
import { toClaudeAnswers, toQuestions, type ClaudeQuestion } from './events.js';
import { guardReason, readsRepositories } from './guard.js';
import { isMemoryTool } from './memory.js';
import { PERMISSION_MODES } from './options.js';
import { alwaysRules, formatRule, ProjectPermissions, toPermissionRequest } from './permissions.js';

/**
 * Tools that never ask: they only read, or load skills and tools the user installed. They are allowed in
 * `canUseTool`, since bare allow rules would bypass it.
 */
const UNASKED = new Set(['WebFetch', 'WebSearch', 'Skill', 'ToolSearch', 'ListMcpResourcesTool', 'ReadMcpResourceTool']);

export interface ApprovalsOptions {
  cwd: string;
  /** The turn in progress, whose panels ask the user. */
  turn(): RunContext | undefined;
  /** The user approved a plan and picked the mode to carry on in. */
  onPlanApproved(mode: AgentMode): Promise<void>;
}

/**
 * Everything Claude Code asks Jinion before a tool runs: the guard that always asks about commits and changes outside
 * the project, and the questions, plans and permissions the user answers in panels.
 */
export class ClaudeApprovals {
  private readonly permissions: ProjectPermissions;
  /** Whole tools the user allowed. They are checked here, since bare allow rules would bypass `canUseTool`. */
  private readonly allowedTools = new Set<string>();

  constructor(private readonly options: ApprovalsOptions) {
    this.permissions = new ProjectPermissions(options.cwd);
  }

  /** The rules the user saved for this project that Claude Code checks itself, for a process about to start. */
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
    const reason = guardReason(input.tool_name, (input.tool_input ?? {}) as Record<string, unknown>, this.options.cwd);
    if (!reason) return {};
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } };
  };

  readonly canUseTool: CanUseTool = async (name, input, options) => {
    if (UNASKED.has(name) || this.allowedTools.has(name) || readsRepositories(name, input)) return { behavior: 'allow', updatedInput: input };
    const turn = this.options.turn();
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
  };
}
