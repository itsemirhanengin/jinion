import type { ToolRun } from '../agent/tools.js';
import { clip } from '../lib/text.js';
import type { Entry } from './entries.js';

/** Enough to carry on a long conversation without filling a fresh context; the newest part is kept. */
const MAX_CHARS = 60_000;

/**
 * The conversation so far, for a backend it moved to, which saw none of it: the messages, the replies, and a line
 * for each tool call. It goes before the first prompt that backend gets.
 */
export function handoff(entries: Entry[], prompt: string) {
  const lines = entries.flatMap(lineOf);
  let kept = lines.join('\n\n');

  if (kept.length > MAX_CHARS) kept = `[earlier part left out]\n\n${kept.slice(kept.length - MAX_CHARS)}`;

  return [
    'This conversation started with another agent and goes on with you. Here is what happened so far; the files are as it left them.',
    `<conversation>\n${kept}\n</conversation>`,
    'The message to answer now:',
    prompt,
  ].join('\n\n');
}

function lineOf(entry: Entry): string[] {
  switch (entry.kind) {
    case 'user':
      return [`User: ${entry.prompt ?? entry.text}`];
    case 'text':
      return [`Agent: ${entry.text}`];
    case 'tool':
      return [`Tool: ${callLine(entry.run)}`];
    case 'compaction':
      return entry.summary ? [`Summary of what came before: ${entry.summary}`] : [];
    case 'task':
      return [`Background task ${entry.task.status}: ${clip(entry.task.title, 200)}${entry.summary ? `. ${clip(entry.summary, 1_000)}` : ''}`];
    default:
      return [];
  }
}

function callLine(run: ToolRun) {
  switch (run.name) {
    case 'read':
      return `read ${run.input.files.map((file) => file.path).join(', ')}`;
    case 'grep':
      return `searched for ${run.input.pattern} in ${run.input.path}`;
    case 'glob':
      return `listed ${run.input.pattern}`;
    case 'bash':
      return `ran ${clip(run.input.command, 300)}${run.result ? `, exit code ${run.result.exitCode}` : ''}`;
    case 'edit':
      return `${run.input.created ? 'created' : 'edited'} ${run.input.path}`;
    case 'todo':
      return `updated the task list: ${run.input.groups.flatMap((group) => group.items.map((item) => `${item.text} (${item.status})`)).join('; ')}`;
    case 'ask':
      return `asked the user ${run.input.questions.map((question) => question.prompt).join(' / ')}${run.result ? `, who answered ${JSON.stringify(run.result.answers)}` : ''}`;
    case 'memory':
      return `${run.input.action} a note: ${clip(run.input.detail, 200)}`;
    case 'plan':
      return `proposed a plan: ${clip(run.input.plan, 2_000)}`;
    case 'fetch':
      return `fetched ${run.input.url}`;
    case 'search':
      return `searched the web for ${run.input.query}`;
    case 'mcp':
      return `called ${run.input.tool} on ${run.input.server}`;
    case 'agent':
      return `had a subagent ${run.input.description}`;
    case 'other':
      return run.input.title;
  }
}
