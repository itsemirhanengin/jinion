import { firstLine, truncate } from '../../lib/text.js';
import { type Input, text } from './input.js';

/** `mcp__github__create_issue` reads as `github:create_issue`, without a claude.ai connector's or plugin's prefix. */
export function toolTitle(name: string) {
  const mcp = /^mcp__(.+?)__(.+)$/.exec(name);
  if (!mcp) return name;
  const server = mcp[1]!.replace(/^claude_ai_/, '').replace(/^plugin_[^_]+_/, '');
  return `${server}:${mcp[2]}`;
}

export function toolQuery(query: string) {
  if (!query.startsWith('select:')) return query;
  return query.slice('select:'.length).split(',').map((name) => toolTitle(name.trim())).join(', ');
}

const SUMMARY_KEYS = ['url', 'query', 'file_path', 'path', 'command', 'description', 'prompt'];

export function inputSummary(input: Input) {
  const key = SUMMARY_KEYS.find((candidate) => typeof input[candidate] === 'string');
  return truncate(firstLine(key ? text(input[key]) : ''), 80) || undefined;
}
