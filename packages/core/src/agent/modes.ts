import type { AgentMode } from './agent.js';

export const MODES: Record<AgentMode, { name: string; description: string }> = {
  manual: { name: 'Manual', description: 'Asks before every edit and every command outside a safe list' },
  edits: { name: 'Accept edits', description: 'Edits files in the project without asking; asks before risky commands' },
  plan: { name: 'Plan', description: 'Reads and plans; changes nothing until you approve the plan' },
  auto: {
    name: 'Auto',
    description:
      'A safety classifier lets routine actions run and stops risky ones; writes outside the project still ask, and commits too unless /commit-approval is off',
  },
};

export const nextMode = (modes: AgentMode[], current: AgentMode) => modes[(modes.indexOf(current) + 1) % modes.length] ?? current;
