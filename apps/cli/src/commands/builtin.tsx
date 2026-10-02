import type { Jinion } from '../context.js';
import { HelpPanel } from '../panels/help.js';
import { importClaudeMemory } from '../memory/import.js';
import { AccountPicker } from '../panels/account.js';
import { MemoryPanel } from '../panels/memory.js';
import { ModePicker } from '../panels/mode.js';
import { findModel, ModelPicker } from '../panels/model.js';
import { MODES } from '../modes.js';
import type { AgentMode } from '../agent/types.js';
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
    name: 'mode',
    description: 'How freely the agent acts: manual, accept edits, plan or auto (shift+tab)',
    source: 'builtin',
    argumentHint: '[mode]',
    run: (app, args) => {
      const wanted = args.trim().toLowerCase();
      if (!wanted) return app.panels.open({ id: 'mode', placement: 'bottom', element: <ModePicker /> });
      const mode = app.modes.available.find(
        (candidate) => candidate === wanted || MODES[candidate].name.toLowerCase() === wanted,
      ) as AgentMode | undefined;
      if (!mode) {
        const names = app.modes.available.join(', ');
        return app.actions.notice(`No mode "${args.trim()}". Pick one of ${names}, or type /mode.`, 'error');
      }
      app.actions.selectMode(mode);
    },
  },
  {
    name: 'account',
    description: 'Switch between your logins, or add one (account add <name>)',
    source: 'builtin',
    argumentHint: '[name | add <name>]',
    run: (app, args) => {
      if (!app.accounts.manager) return app.actions.notice(`${app.model.agent} has a single login.`, 'warning');
      const [first = '', second = ''] = args.trim().split(/\s+/);
      const open = (signIn?: string) =>
        app.panels.open({ id: 'account', placement: 'bottom', element: <AccountPicker signIn={signIn} /> });
      if (!first) return open();
      if (first === 'add') return second ? open(second) : open();
      app.actions.selectAccount(first);
    },
  },
  {
    name: 'remember',
    description: 'Save a note the agent keeps in later conversations (remember user … for every project)',
    source: 'builtin',
    argumentHint: '<note>',
    run: (app, args) => {
      const [first = '', ...rest] = args.trim().split(/\s+/);
      const scope = first === 'user' || first === 'project' ? first : 'project';
      const content = (first === scope ? rest.join(' ') : args).trim();
      if (!content) return app.actions.notice('Say what to remember, e.g. /remember use pnpm, not npm.', 'warning');
      const line = content.split('\n')[0]!;
      const memory = app.memory.save({
        scope,
        type: scope === 'user' ? 'preference' : 'fact',
        title: line.length > 60 ? `${line.slice(0, 59)}…` : line,
        description: line.length > 160 ? `${line.slice(0, 159)}…` : line,
        content,
      });
      app.actions.notice(`Saved ${memory.scope}/${memory.id}. The agent sees it from the next conversation on.`, 'success');
    },
  },
  {
    name: 'memory',
    description: 'The notes the agent keeps; memory import brings in Claude Code\'s',
    source: 'builtin',
    argumentHint: '[import]',
    run: (app, args) => {
      if (args.trim() !== 'import') return app.panels.open({ id: 'memory', placement: 'bottom', element: <MemoryPanel /> });
      const { added, skipped } = importClaudeMemory(app.memory, app.info.cwd);
      const note = skipped > 0 ? ` (${skipped} already here)` : '';
      app.actions.notice(
        added > 0
          ? `Imported ${added} notes from Claude Code${note}. The agent sees them from the next conversation on.`
          : `Nothing new to import from Claude Code${note}.`,
        added > 0 ? 'success' : 'muted',
      );
    },
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
