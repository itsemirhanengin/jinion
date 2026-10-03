import { describe, expect, it } from 'vitest';
import { inputSummary, toolQuery, toolTitle } from '../../../src/agent/claude/tool-names.js';

describe('tool names', () => {
  it('names MCP tools by server and tool, without connector and plugin prefixes', () => {
    expect(toolTitle('mcp__github__create_issue')).toBe('github:create_issue');
    expect(toolTitle('mcp__claude_ai_Linear__list_issues')).toBe('Linear:list_issues');
    expect(toolTitle('mcp__plugin_vercel_vercel__deploy')).toBe('vercel:deploy');
    expect(toolTitle('WebFetch')).toBe('WebFetch');
  });

  it('reads a ToolSearch selection as the tools’ titles', () => {
    expect(toolQuery('select:mcp__context7__query-docs, mcp__context7__resolve-library-id')).toBe('context7:query-docs, context7:resolve-library-id');
    expect(toolQuery('slack send')).toBe('slack send');
  });

  it('sums up a call by its first telling field, on one line', () => {
    expect(inputSummary({ prompt: 'p', url: 'https://example.com' })).toBe('https://example.com');
    expect(inputSummary({ command: `first\nsecond` })).toBe('first');
    expect(inputSummary({ query: 'x'.repeat(100) })).toBe(`${'x'.repeat(79)}…`);
    expect(inputSummary({ count: 3 })).toBeUndefined();
  });
});
