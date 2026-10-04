import { account, mcp, mode } from './agent.js';
import { clear, close, compact, exit, rename, resume, rewind, tab } from './conversation.js';
import { memory, remember } from './memory.js';
import { effort, model } from './model.js';
import { notifications } from './notifications.js';
import type { Command } from './registry.js';
import { context, diff, expand, help, stats, statusline, tasks, usage } from './views.js';
import { worktree } from './worktree.js';

/** In the order the palette and `/help` list them. */
export const builtinCommands: Command[] = [
  model,
  effort,
  help,
  resume,
  mode,
  account,
  remember,
  memory,
  mcp,
  diff,
  compact,
  context,
  usage,
  stats,
  tasks,
  rename,
  rewind,
  worktree,
  notifications,
  statusline,
  clear,
  tab,
  close,
  expand,
  exit,
];
