import type { Jinion } from '../context.js';
import { HelpPanel } from '../panels/help.js';
import { findModel, ModelPicker } from '../panels/model.js';
import { ResumePanel } from '../panels/resume.js';
import { StatusLinePanel } from '../panels/statusline.js';
import type { Command } from './registry.js';

const openModelPicker = (app: Jinion) =>
  app.panels.open({ id: 'model', placement: 'bottom', element: <ModelPicker /> });

/** The listed models, or `undefined` after telling the user they are not known yet. */
function modelOptions(app: Jinion) {
  if (app.model.options) return app.model.options;
  app.actions.notice(`${app.model.agent} is still listing its models. Try again in a moment.`, 'warning');
  return undefined;
}

export const builtinCommands: Command[] = [
  {
    name: 'model',
    description: 'Switch the model and its effort',
    source: 'builtin',
    argumentHint: '[model]',
    run: (app, args) => {
      if (!args.trim()) return openModelPicker(app);
      const options = modelOptions(app);
      if (!options) return;
      const model = findModel(options, args);
      if (!model) return app.actions.notice(`No model matches "${args.trim()}". Type /model to pick one.`, 'error');
      // Effort carries over when the new model has the same level.
      const { effort } = app.model.selection;
      app.actions.selectModel({ model: model.id, effort: effort && model.efforts.includes(effort) ? effort : undefined });
    },
  },
  {
    name: 'effort',
    description: 'Change how hard the model thinks',
    source: 'builtin',
    argumentHint: '[level]',
    run: (app, args) => {
      if (!args.trim()) return openModelPicker(app);
      const options = modelOptions(app);
      if (!options) return;
      const level = args.trim().toLowerCase();
      const levels = options.find((option) => option.id === app.model.selection.model)?.efforts ?? [];
      if (levels.length === 0) return app.actions.notice(`${app.model.name} has no effort setting.`, 'error');
      if (level !== 'default' && !levels.includes(level)) {
        return app.actions.notice(`${app.model.name} takes ${[...levels, 'default'].join(', ')}.`, 'error');
      }
      app.actions.selectModel({ ...app.model.selection, effort: level === 'default' ? undefined : level });
    },
  },
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
    name: 'statusline',
    description: 'Choose what the status line shows',
    source: 'builtin',
    run: (app) => app.panels.open({ id: 'statusline', placement: 'bottom', element: <StatusLinePanel /> }),
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
