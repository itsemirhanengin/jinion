import { HelpPanel } from '../panels/help.js';
import { ResumePanel } from '../panels/resume.js';
import type { Command } from './registry.js';

export const builtinCommands: Command[] = [
  {
    name: 'help',
    description: 'Shortcuts, commands, skills and MCP prompts',
    source: 'builtin',
    argumentHint: '[tab]',
    run: (app, args) => app.panels.open({ id: 'help', placement: 'bottom', element: <HelpPanel topic={args} /> }),
  },
  {
    name: 'resume',
    description: 'Pick up a previous conversation',
    source: 'builtin',
    argumentHint: '[search]',
    run: (app, args) =>
      app.panels.open({ id: 'resume', placement: 'fullscreen', element: <ResumePanel query={args} /> }),
  },
  {
    name: 'clear',
    aliases: ['new'],
    description: 'Save this conversation and start a new one',
    source: 'builtin',
    run: (app) => app.actions.newSession(),
  },
  {
    name: 'expand',
    description: 'Expand or collapse long output (ctrl+o)',
    source: 'builtin',
    run: (app) => app.actions.toggleExpanded(),
  },
  {
    name: 'exit',
    aliases: ['quit'],
    description: 'Quit jinion',
    source: 'builtin',
    run: (app) => app.actions.exit(),
  },
];
