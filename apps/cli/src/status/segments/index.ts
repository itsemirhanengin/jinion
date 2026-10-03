import type { Segment } from '../segment.js';
import { changes, duration, tasks, time, title, turns } from './conversation.js';
import { git, worktree } from './git.js';
import { account, agent, brand, directory, mode, model, version } from './identity.js';
import { context, cost, limits } from './usage.js';

/** In the order `/statusline` lists them. */
export const SEGMENTS: Segment[] = [
  brand,
  model,
  account,
  mode,
  directory,
  worktree,
  git,
  context,
  limits,
  cost,
  changes,
  tasks,
  title,
  duration,
  turns,
  time,
  agent,
  version,
];

export const findSegment = (id: string) => SEGMENTS.find((segment) => segment.id === id);
