import { join } from 'node:path';
import type { McpServerStatus } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { McpConfig } from '../../../src/mcp/config.js';
import { sandboxEach } from '../../support/sandbox.js';
import { serverInfos, toClaudeServer } from '../../../src/agent/claude/mcp.js';

const box = sandboxEach();

describe('serverInfos', () => {
  it('lists what runs together with what is off, configured ones first', () => {
    box.write(join(box.home, '.claude.json'), {
      mcpServers: { context7: { type: 'http', url: 'https://mcp.context7.com/mcp' }, quiet: { command: 'quiet-server' } },
    });

    const config = new McpConfig(box.project);

    config.setEnabled({ name: 'quiet', source: 'claude' }, false);
    config.setEnabled({ name: 'claude.ai Gmail' }, false);

    const statuses: McpServerStatus[] = [
      { name: 'jinion', status: 'connected' },
      { name: 'claude.ai Linear', status: 'connected', tools: [{ name: 'list_issues' }], config: { type: 'claudeai-proxy', url: 'https://mcp.linear.app/mcp', id: 'x' } },
      { name: 'context7', status: 'connected', tools: [{ name: 'query-docs' }, { name: 'resolve-library-id' }] },
      { name: 'plugin:vercel:vercel', status: 'pending' },
      { name: 'claude.ai Slack', status: 'needs-auth' },
    ];

    const infos = serverInfos(statuses, config).map(({ label, source, status, tools }) => `${label} ${source} ${status} ${tools.length}`);

    expect(infos).toEqual([
      'context7 claude code connected 2',
      'quiet claude code off 0',
      'vercel plugin vercel pending 0',
      'Gmail claude.ai off 0',
      'Linear claude.ai connected 1',
      'Slack claude.ai needs-auth 0',
    ]);
  });

  it('shows where a server runs', () => {
    box.write(join(box.home, '.claude.json'), { mcpServers: { local: { command: 'node', args: ['server.js'] } } });
    const [local] = serverInfos([], new McpConfig(box.project));

    expect(local).toMatchObject({ target: 'node server.js', status: 'pending', enabled: true });
  });
});

describe('toClaudeServer', () => {
  it('maps the .mcp.json shapes to Claude Code’s', () => {
    expect(toClaudeServer({ command: 'node', args: ['a.js'] })).toEqual({ type: 'stdio', command: 'node', args: ['a.js'], env: undefined });
    expect(toClaudeServer({ type: 'sse', url: 'https://x' })).toEqual({ type: 'sse', url: 'https://x', headers: undefined });
  });
});
