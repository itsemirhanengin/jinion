import type { Theme } from '@jinion/tui';
import type { AgentMode } from '../agent/agent.js';

/** Auto stands out the most, since it acts on its own. */
export function modeColor(theme: Theme, mode: AgentMode) {
  if (mode === 'auto') return theme.warning;
  if (mode === 'plan') return theme.code;
  if (mode === 'edits') return theme.accent;

  return theme.muted;
}
