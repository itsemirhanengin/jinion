import { asksBeforeCommits, saveProjectSettings } from '../settings/project.js';
import { loadSettings, saveAskBeforeCommits } from '../settings/user.js';
import type { Command } from './registry.js';

export const commitApproval: Command = {
  name: 'commit-approval',
  description: 'Turn on or off asking before every commit, in this project or, with global, in every project',
  argumentHint: '[on | off] [global]',
  run: (jinion, args) => {
    const words = args.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const global = words.includes('global');
    const [wanted, ...rest] = words.filter((word) => word !== 'global');

    if (rest.length > 0 || (wanted && wanted !== 'on' && wanted !== 'off')) {
      return jinion.notice('Type /commit-approval on or /commit-approval off, with global to set it for every project.', 'error');
    }

    const { cwd } = jinion.info;
    const current = global ? (loadSettings().askBeforeCommits ?? true) : asksBeforeCommits(cwd);
    const on = wanted ? wanted === 'on' : !current;

    if (global) {
      saveAskBeforeCommits(on);
      // Otherwise this project's own setting would hide the one just made.
      saveProjectSettings(cwd, { askBeforeCommits: undefined });
    } else saveProjectSettings(cwd, { askBeforeCommits: on });

    const where = global ? 'in every project without a setting of its own' : 'in this project';
    if (on) return jinion.notice(`Jinion asks before every commit ${where}.`, 'success');

    jinion.notice(
      `Jinion no longer asks before commits ${where}; the mode decides, as for any command. /commit-approval on${global ? ' global' : ''} asks again.`,
      'muted',
    );
  },
};
