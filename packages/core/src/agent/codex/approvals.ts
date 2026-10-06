import { errorMessage } from '../../lib/errors.js';
import type { AgentMode, RunContext } from '../agent.js';
import type { PermissionDecision, PermissionRequest } from '../permissions.js';
import type { Question, QuestionAnswer } from '../questions.js';
import { elicit } from './elicitation.js';
import { type JinionTools, runJinionTool } from './jinion-tools.js';
import type { ServerRequest, ServerRequests, UserInputRequest } from './protocol.js';
import { unwrapShell } from './tool-calls.js';

export interface ApprovalContext {
  /** The turn the request belongs to; nothing is asked without one. */
  turn(): RunContext | undefined;
  /** The edits of a patch Codex asks about, by its item id, each with the id of the call that shows it. */
  edits(item: string): { id: string; path: string }[];
  /** Tells the running turn why the user said no. */
  steer(note: string): void;
  /** Auto runs a command in a terminal without asking, as Codex's reviewer would let a command run. */
  mode(): AgentMode;
  tools: JinionTools;
}

/** What Codex asks during a turn: approvals and questions go to the user, Jinion's own tools run here. */
export async function answer(request: ServerRequest, context: ApprovalContext): Promise<ServerRequests[ServerRequest['method']]['result']> {
  const turn = context.turn();

  switch (request.method) {
    case 'item/commandExecution/requestApproval': {
      const { itemId, command = '', commandActions, reason, availableDecisions } = request.params;
      const [only] = commandActions ?? [];
      const forConversation = !availableDecisions || availableDecisions.includes('acceptForSession');

      const asked: PermissionRequest = {
        title: 'jinion wants to run a command',
        command: commandActions?.length === 1 && only ? only.command : unwrapShell(command ?? ''),
        description: reason ?? undefined,
        always: forConversation ? 'this command in this conversation' : undefined,
      };

      return { decision: await decide(turn, asked, itemId, context) };
    }

    case 'item/fileChange/requestApproval': {
      const { itemId, reason, grantRoot } = request.params;
      const edits = context.edits(itemId);

      const asked: PermissionRequest = {
        title: edits.length > 1 ? `jinion wants to change ${edits.length} files` : 'jinion wants to change a file',
        subject: edits.map((edit) => edit.path).join(', ') || grantRoot || undefined,
        description: reason ?? undefined,
        always: 'edits in this conversation',
      };

      // The first file's edit shows the patch as waiting for the user.
      return { decision: await decide(turn, asked, edits[0]?.id ?? itemId, context) };
    }

    case 'item/permissions/requestApproval': {
      const { itemId, reason, permissions } = request.params;
      const asked: PermissionRequest = { title: 'jinion wants more access than its sandbox gives', description: reason ?? undefined, always: 'this access in this conversation' };
      const decision = await decide(turn, asked, itemId, context);
      const granted = Object.fromEntries(Object.entries(permissions).filter(([, value]) => value !== null));

      return { permissions: decision === 'accept' || decision === 'acceptForSession' ? granted : {}, scope: decision === 'acceptForSession' ? 'session' : 'turn' };
    }

    case 'item/tool/requestUserInput':
      return { answers: turn ? await ask(turn, request.params) : {} };

    case 'item/tool/call': {
      const { tool, arguments: input, callId } = request.params;

      // Codex leaves Jinion's tools to Jinion, so a command started in a terminal is asked about here.
      if (tool === 'run_in_terminal' && context.mode() !== 'auto') {
        const { command } = (input ?? {}) as { command?: unknown };
        const asked: PermissionRequest = { title: 'jinion wants to run a command in a terminal', command: String(command ?? '') };
        const decision = await decide(turn, asked, callId, context);

        if (decision !== 'accept' && decision !== 'acceptForSession') {
          return { contentItems: [{ type: 'inputText', text: "The user said no. Don't try to get around it; ask what to do instead if it's still needed." }], success: false };
        }
      }

      try {
        const text = await runJinionTool(context.tools, tool, input);
        if (text === undefined) throw new Error(`Jinion has no tool called ${tool}.`);

        return { contentItems: [{ type: 'inputText', text }], success: true };
      } catch (error) {
        return { contentItems: [{ type: 'inputText', text: errorMessage(error) }], success: false };
      }
    }

    case 'mcpServer/elicitation/request':
      return elicit(request.params, turn);
  }
}

/** A dialog the user cancels, or a turn that is interrupted meanwhile, cancels the request and Codex's turn with it. */
async function decide(turn: RunContext | undefined, asked: PermissionRequest, item: string, context: ApprovalContext) {
  if (!turn) return 'decline';

  let decision: PermissionDecision;

  try {
    decision = await turn.approve(asked, item);
  } catch {
    return 'cancel';
  }

  if (decision.allow) return decision.always ? 'acceptForSession' : 'accept';

  if (decision.note) context.steer(decision.note);

  return 'decline';
}

async function ask(turn: RunContext, { questions }: UserInputRequest) {
  const asked: Question[] = questions.map(({ id, question, options, isOther }) => ({
    id,
    prompt: question,
    options: (options ?? []).map(({ label, description }) => ({ label, description: description || undefined })),
    other: isOther || !options?.length,
  }));

  let answers: QuestionAnswer[];

  try {
    answers = await turn.ask(asked);
  } catch {
    return {};
  }

  return Object.fromEntries(
    asked.map((question, index) => {
      const answered = answers[index];
      const picked = (answered?.options ?? []).flatMap((option) => question.options[option]?.label ?? []);

      return [question.id, { answers: [...picked, ...(answered?.text ? [answered.text] : [])] }];
    }),
  );
}
