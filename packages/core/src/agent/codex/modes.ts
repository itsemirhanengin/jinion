import type { AgentMode } from '../agent.js';
import type { ModelSelection } from '../models.js';
import type { ApprovalsReviewer, CollaborationMode, SandboxPolicy } from './protocol.js';

/**
 * Manual is Codex's Read Only: reads run, and every edit or command that writes asks. The other modes write in the
 * project as Codex resolved it for the conversation, so the network access the user gave Codex stays. Auto has Codex's
 * own reviewer, a subagent that weighs the risk, answer for the user, as Claude's safety classifier does.
 */
export function modeSettings(mode: AgentMode, { model, effort }: ModelSelection, workspace: SandboxPolicy) {
  const approvalsReviewer: ApprovalsReviewer = mode === 'auto' ? 'auto_review' : 'user';
  const networkAccess = workspace.type === 'workspaceWrite' && workspace.networkAccess;
  const sandboxPolicy: SandboxPolicy = mode === 'manual' ? { type: 'readOnly', networkAccess } : workspace;

  const collaborationMode: CollaborationMode = {
    mode: mode === 'plan' ? 'plan' : 'default',
    settings: { model, reasoning_effort: effort ?? null, developer_instructions: null },
  };

  return { approvalPolicy: 'on-request' as const, approvalsReviewer, sandboxPolicy, collaborationMode };
}
