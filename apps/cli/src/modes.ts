import type { Theme } from '@jinion/tui';
import type { AgentMode } from './agent/types.js';

export const MODES: Record<AgentMode, { name: string; description: string }> = {
  manual: { name: 'Manual', description: 'Asks before every edit and every command outside a safe list' },
  edits: { name: 'Accept edits', description: 'Edits files in the project without asking; asks before risky commands' },
  plan: { name: 'Plan', description: 'Reads and plans; changes nothing until you approve the plan' },
  auto: {
    name: 'Auto',
    description: 'A safety classifier lets routine actions run and stops risky ones; commits and writes outside the project still ask',
  },
};

/** The mode after `current` in `modes`, as shift+tab goes. */
export function nextMode(modes: AgentMode[], current: AgentMode) {
  return modes[(modes.indexOf(current) + 1) % modes.length] ?? current;
}

/** Auto stands out the most, since it acts on its own. */
export function modeColor(theme: Theme, mode: AgentMode) {
  if (mode === 'auto') return theme.warning;
  if (mode === 'plan') return theme.code;
  if (mode === 'edits') return theme.accent;
  return theme.muted;
}
