import { describe, expect, it, vi } from 'vitest';
import type { PlanDecision, RunContext } from '../../../src/agent/agent.js';
import { ClaudeApprovals } from '../../../src/agent/claude/approvals.js';

const cwd = '/work/project';

function approvalsWith(decision: PlanDecision) {
  const rewritePlan = vi.fn();
  const turn = { approvePlan: vi.fn(async () => decision) } as unknown as RunContext;
  const approvals = new ClaudeApprovals({ project: cwd, cwd: () => cwd, turn: () => turn, onPlanApproved: async () => {}, rewritePlan });
  const options = { signal: new AbortController().signal, toolUseID: 'call-1' } as Parameters<ClaudeApprovals['canUseTool']>[2];

  return { rewritePlan, approve: () => approvals.canUseTool('ExitPlanMode', {}, options) };
}

describe('approving a plan', () => {
  it('hands Claude Code the plan as the user changed it, in its file and its call, saying they changed it', async () => {
    const { rewritePlan, approve } = approvalsWith({ approve: true, mode: 'auto', plan: '# Plan\n\n- Only the API' });
    const plan = '> The user changed this plan before approving it. Build it as it stands now.\n\n# Plan\n\n- Only the API\n';

    await expect(approve()).resolves.toMatchObject({ behavior: 'allow', updatedInput: { plan } });
    expect(rewritePlan).toHaveBeenCalledWith(plan);
  });

  it('leaves a plan the user didn’t change as the agent wrote it', async () => {
    const { rewritePlan, approve } = approvalsWith({ approve: true, mode: 'auto' });

    await expect(approve()).resolves.toMatchObject({ behavior: 'allow', updatedInput: {} });
    expect(rewritePlan).not.toHaveBeenCalled();
  });
});
