import type { PermissionMode } from '@anthropic-ai/claude-agent-sdk';
import type { AgentMode } from '../agent.js';

export const TOOLS = [
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

export const PERMISSION_MODES: Record<AgentMode, PermissionMode> = {
  manual: 'default',
  edits: 'acceptEdits',
  plan: 'plan',
  auto: 'auto',
};

const MODES_BY_PERMISSION = new Map(Object.entries(PERMISSION_MODES).map(([mode, permission]) => [permission as string, mode as AgentMode]));

export const modeOf = (permissionMode: string) => MODES_BY_PERMISSION.get(permissionMode);

/** Edits inside the project are allowed by `acceptEdits`; anything else asks the user. */
export const ALLOWED = [
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

/** `acceptEdits` would run these without asking. Auto mode leaves them to its classifier, which knows when a removal throws work away. */
const ASK = ['Bash(rm *)', 'Bash(rmdir *)', 'Bash(mv *)', 'Bash(cp *)', 'Bash(sed *)'];

export const askRules = (mode: AgentMode) => (mode === 'edits' ? ASK : []);
