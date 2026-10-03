import { openRewind } from '../panels/rewind/open.js';
import { ResumePanel } from '../panels/resume.js';
import type { Command } from './registry.js';

export const resume: Command = {
  name: 'resume',
  description: 'Pick up a previous conversation',
  argumentHint: '[search]',
  run: (jinion, args) => jinion.screen.openPanel({ id: 'resume', placement: 'fullscreen', element: <ResumePanel query={args} /> }),
};

export const compact: Command = {
  name: 'compact',
  description: 'Summarize the conversation so far to free context, keeping what you say above all',
  argumentHint: '[focus]',
  run: (jinion, args) => jinion.turns.compact(args.trim() || undefined),
};

export const rename: Command = {
  name: 'rename',
  description: 'Name this conversation, to find it in /resume; without a name, jinion names it from what it is about',
  argumentHint: '[name]',
  run: (jinion, args) => jinion.conversation.rename(args.trim() || undefined),
};

export const rewind: Command = {
  name: 'rewind',
  description: 'Go back to before an earlier message: code, conversation or both (esc esc)',
  run: openRewind,
};

export const clear: Command = {
  name: 'clear',
  aliases: ['new'],
  description: 'Save this conversation and start a new one',
  run: (jinion) => jinion.conversation.newSession(),
};

export const exit: Command = {
  name: 'exit',
  aliases: ['quit'],
  description: 'Quit jinion',
  run: (jinion) => jinion.quit(),
};
