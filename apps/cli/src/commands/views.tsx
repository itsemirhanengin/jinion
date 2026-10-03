import { ContextPanel } from '../panels/context.js';
import { openDiff } from '../panels/diff/open.js';
import { HelpPanel } from '../panels/help.js';
import { StatusLinePanel } from '../panels/statusline.js';
import { openTasks } from '../panels/tasks/open.js';
import { UsagePanel } from '../panels/usage/usage-panel.js';
import type { Command } from './registry.js';

export const help: Command = {
  name: 'help',
  description: 'Shortcuts, commands, skills and MCP prompts',
  argumentHint: '[tab]',
  run: (jinion, args) => jinion.screen.openPanel({ id: 'help', placement: 'bottom', element: <HelpPanel topic={args} /> }),
};

export const diff: Command = {
  name: 'diff',
  description: 'What changed since the last commit, in every repository here, with the agent’s changes marked',
  run: (jinion) => openDiff(jinion),
};

export const context: Command = {
  name: 'context',
  description: 'What fills the context window, and when the agent compacts on its own',
  run: (jinion) => jinion.screen.openPanel({ id: 'context', placement: 'bottom', element: <ContextPanel /> }),
};

export const usage: Command = {
  name: 'usage',
  description: 'Plan limits, this session, and what adds to the limits',
  run: (jinion) => jinion.screen.openPanel({ id: 'usage', placement: 'fullscreen', element: <UsagePanel tab="usage" /> }),
};

export const stats: Command = {
  name: 'stats',
  description: 'Every day of use on this machine as a calendar, with streaks and models',
  run: (jinion) => jinion.screen.openPanel({ id: 'usage', placement: 'fullscreen', element: <UsagePanel tab="stats" /> }),
};

export const tasks: Command = {
  name: 'tasks',
  description: 'What runs in the background: dev servers, long commands, subagents; x stops one (ctrl+t)',
  run: openTasks,
};

export const statusline: Command = {
  name: 'statusline',
  description: 'Choose what the status line shows',
  run: (jinion) => jinion.screen.openPanel({ id: 'statusline', placement: 'bottom', element: <StatusLinePanel /> }),
};

export const expand: Command = {
  name: 'expand',
  description: 'Expand or collapse all long output (ctrl+o)',
  run: (jinion) => jinion.screen.toggleExpanded(),
};
