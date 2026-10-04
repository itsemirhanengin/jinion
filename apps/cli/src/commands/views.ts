import type { Command } from './registry.js';

export const help: Command = {
  name: 'help',
  description: 'Shortcuts, commands, skills and MCP prompts',
  argumentHint: '[tab]',
  run: (jinion, args) => jinion.screen.openView({ id: 'help', topic: args }),
};

export const diff: Command = {
  name: 'diff',
  description: 'What changed since the last commit, in every repository here, with the agent’s changes marked',
  run: (jinion) => jinion.screen.openView({ id: 'diff' }),
};

export const context: Command = {
  name: 'context',
  description: 'What fills the context window, and when the agent compacts on its own',
  run: (jinion) => jinion.screen.openView({ id: 'context' }),
};

export const usage: Command = {
  name: 'usage',
  description: 'Plan limits, this session, and what adds to the limits',
  run: (jinion) => jinion.screen.openView({ id: 'usage', tab: 'usage' }),
};

export const stats: Command = {
  name: 'stats',
  description: 'Every day of use on this machine as a calendar, with streaks and models',
  run: (jinion) => jinion.screen.openView({ id: 'usage', tab: 'stats' }),
};

export const tasks: Command = {
  name: 'tasks',
  description: 'What runs in the background: dev servers, long commands, subagents; x stops one (ctrl+t)',
  run: (jinion) => jinion.screen.openView({ id: 'tasks' }),
};

export const statusline: Command = {
  name: 'statusline',
  description: 'Choose what the status line shows',
  run: (jinion) => jinion.screen.openView({ id: 'statusline' }),
};

export const expand: Command = {
  name: 'expand',
  description: 'Expand or collapse all long output (ctrl+o)',
  run: (jinion) => jinion.screen.toggleExpanded(),
};
