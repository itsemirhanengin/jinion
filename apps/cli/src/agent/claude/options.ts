import type { EffortLevel, Options } from '@anthropic-ai/claude-agent-sdk';
import type { ModelSelection } from '@jinion/tui/chat';
import type { McpConfig } from '../../mcp/config.js';
import type { MemoryStore } from '../../memory/store.js';
import type { AgentMode } from '../agent.js';
import { accountEnv } from './accounts.js';
import type { ClaudeApprovals } from './approvals.js';
import { toClaudeServer } from './mcp.js';
import { MEMORY_SERVER, memoryServer } from './memory.js';
import { CLAUDE_CODE_SKILLS, claudePlugins, skillPlugins } from './plugins.js';
import { ALLOWED, askRules, PERMISSION_MODES, TOOLS } from './policy.js';
import type { ClaudeResume } from './process.js';
import { systemPrompt } from './prompt.js';

export interface ClaudeSetup {
  cwd: string;
  selection: ModelSelection;
  mode: AgentMode;
  account: string;
  resume?: ClaudeResume;
  memory?: MemoryStore;
  mcp?: McpConfig;
  approvals: ClaudeApprovals;
}

export function claudeOptions({ cwd, selection, mode, account, resume, memory, mcp, approvals }: ClaudeSetup): Options {
  const servers = (mcp?.servers() ?? []).filter((server) => mcp!.isEnabled(server));
  const disabled = mcp?.disabled() ?? [];
  // Forced colors would put escape codes into command output the model reads.
  const { FORCE_COLOR: _, ...env } = process.env;

  return {
    cwd,
    model: selection.model,
    effort: selection.effort as EffortLevel | undefined,
    resume: resume?.sessionId,
    resumeSessionAt: resume?.at,
    enableFileCheckpointing: true,
    // Not snapshotted, so a resumed conversation sees the notes saved since it began.
    systemPrompt: { type: 'custom', prompt: systemPrompt(cwd, memory), snapshot: false },
    // Claude Code's own settings, CLAUDE.md files and memory stay out. Jinion passes the MCP servers configured in files
    // itself; Claude Code adds the account's claude.ai connectors and the plugins' servers.
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
    allowedTools: [...ALLOWED, ...approvals.savedRules()],
    permissionMode: PERMISSION_MODES[mode],
    canUseTool: approvals.canUseTool,
    hooks: { PreToolUse: [{ hooks: [approvals.guard] }] },
    includePartialMessages: true,
    // The tasks panel stops background tasks one at a time, so esc only stops the turn and leaves them running.
    perTaskStopAffordance: true,
    env: { ...env, ...accountEnv(account) },
  };
}
