import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentMode, RunContext } from '../../../src/agent/agent.js';
import { answer } from '../../../src/agent/codex/approvals.js';
import type { PermissionDecision } from '../../../src/agent/permissions.js';
import { Terminals } from '../../../src/terminals/terminals.js';

let terminals: Terminals;
let shell: string | undefined;

beforeEach(() => {
  shell = process.env.SHELL;
  process.env.SHELL = '/bin/sh';
  terminals = new Terminals();
});

afterEach(() => {
  terminals.closeAll();
  process.env.SHELL = shell;
});

const call = { method: 'item/tool/call' as const, params: { threadId: 't', turnId: 'u', callId: 'call-1', tool: 'run_in_terminal', arguments: { command: 'echo hi' } } };

function context(mode: AgentMode, decision: PermissionDecision) {
  const approve = vi.fn(async () => decision);
  const turn = { approve } as unknown as RunContext;

  return { approve, context: { turn: () => turn, edits: () => [], steer: vi.fn(), mode: () => mode, tools: { terminals, cwd: () => tmpdir() } } };
}

describe('Jinion’s terminal tools in Codex', () => {
  it('asks before a command starts in a terminal, and starts none when the user says no', async () => {
    const { approve, context: asked } = context('manual', { allow: false });

    const result = await answer(call, asked);

    expect(approve).toHaveBeenCalledWith({ title: 'jinion wants to run a command in a terminal', command: 'echo hi' }, 'call-1');
    expect(result).toMatchObject({ success: false });
    expect(terminals.list()).toEqual([]);
  });

  it('runs it at once in auto, as Codex lets a command run there', async () => {
    const { approve, context: auto } = context('auto', { allow: false });

    const result = await answer(call, auto);

    expect(approve).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, contentItems: [{ text: expect.stringContaining('hi') }] });
  });
});
