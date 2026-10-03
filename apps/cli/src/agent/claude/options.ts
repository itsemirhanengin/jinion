import type { EffortLevel, Options, PermissionMode } from '@anthropic-ai/claude-agent-sdk';
import type { ModelSelection } from '@jinion/tui';
import type { McpConfig } from '../../mcp/config.js';
import type { MemoryStore } from '../../memory/store.js';
import type { AgentMode, AgentResume } from '../types.js';
import { accountEnv } from './accounts.js';
import type { ClaudeApprovals } from './approvals.js';
import { toClaudeServer } from './mcp.js';
import { MEMORY_SERVER, memoryServer } from './memory.js';
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

export const askRules = (mode: AgentMode) => (mode === 'edits' ? ASK : []);

/** A conversation to continue, up to `at` after a rewind took the rest away. */
export type ClaudeResume = AgentResume & { at?: string };

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

/**
 * How Jinion starts Claude Code: its own system prompt, tools and permissions, the skills and MCP servers it hands
 * over, and none of Claude Code's own settings, CLAUDE.md files, memory or hooks.
 */
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
    // Files are backed up before each change, so a rewind can restore them.
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
