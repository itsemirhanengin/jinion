import type { Command } from './registry.js';

export const worktree: Command = {
  name: 'worktree',
  description: 'Turn on or off a git worktree of its own for each new conversation (ctrl+g)',
  argumentHint: '[on | off]',
  run: (jinion, args) => {
    const wanted = args.trim().toLowerCase();
    if (wanted && wanted !== 'on' && wanted !== 'off') return jinion.notice('Type /worktree on or /worktree off.', 'error');

    jinion.worktrees.set(wanted ? wanted === 'on' : !jinion.worktrees.on);
  },
};
