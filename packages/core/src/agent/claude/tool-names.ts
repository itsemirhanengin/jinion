import { clip, firstLine, truncate } from '../../lib/text.js';
import { type Input, text } from './input.js';

/** `mcp__github__create_issue` is `github` and `create_issue`, without a claude.ai connector's or plugin's prefix. */
export function mcpTool(name: string) {
  const mcp = /^mcp__(.+?)__(.+)$/.exec(name);
  if (!mcp) return undefined;

  return { server: mcp[1]!.replace(/^claude_ai_/, '').replace(/^plugin_[^_]+_/, ''), tool: mcp[2]! };
}

export function toolTitle(name: string) {
  const mcp = mcpTool(name);

  return mcp ? `${mcp.server}:${mcp.tool}` : name;
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

/** As Claude Code shows an MCP call: `libraryName: "React", query: "hooks"`. */
export function toolArguments(input: Input) {
  const pairs = Object.entries(input).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);

  return clip(pairs.join(', '), 100) || undefined;
}
