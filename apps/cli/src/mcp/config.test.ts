import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadProjectSettings, loadSettings } from '../settings.js';
import { sandbox, type Sandbox } from '../test/sandbox.js';
import { McpConfig } from './config.js';

let box: Sandbox;
beforeEach(() => {
  box = sandbox();
});
afterEach(() => box.restore());

const http = (url: string) => ({ type: 'http', url });

describe('McpConfig', () => {
  it('reads every source, the first one winning on a name', () => {
    box.write(join(box.home, '.jinion', 'mcp.json'), { mcpServers: { shared: http('https://jinion') } });
    box.write(join(box.home, '.claude.json'), {
      mcpServers: { shared: http('https://user'), context7: http('https://context7') },
      projects: { [box.project]: { mcpServers: { local: { command: 'local-server' } } } },
    });
    box.write(join(box.project, '.mcp.json'), { mcpServers: { repo: { command: 'repo-server', args: ['--x'] }, broken: {} } });

    const servers = new McpConfig(box.project).servers();
    expect(servers.map(({ name, source }) => `${name}:${source}`)).toEqual([
      'shared:jinion',
      'local:claude',
      'repo:project',
      'context7:claude',
    ]);
  });

  it('expands ${VAR} and ${VAR:-default} in strings', () => {
    process.env.JINION_TEST_TOKEN = 'secret';
    box.write(join(box.home, '.jinion', 'mcp.json'), {
      mcpServers: {
        api: { type: 'http', url: 'https://${HOST:-example.com}/mcp', headers: { Authorization: 'Bearer ${JINION_TEST_TOKEN}' } },
      },
    });
    expect(new McpConfig(box.project).servers()[0]!.transport).toEqual({
      type: 'http',
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer secret' },
    });
    delete process.env.JINION_TEST_TOKEN;
  });

  it('keeps project servers off until turned on, in that project only', () => {
    box.write(join(box.project, '.mcp.json'), { mcpServers: { repo: { command: 'repo-server' } } });
    const config = new McpConfig(box.project);
    const repo = config.servers()[0]!;
    expect(config.isEnabled(repo)).toBe(false);

    config.setEnabled(repo, true);
    expect(config.isEnabled(repo)).toBe(true);
    expect(loadProjectSettings(box.project).mcp?.approved).toEqual(['repo']);
    expect(new McpConfig(join(box.project, 'other')).isEnabled(repo)).toBe(false);
  });

  it('turns servers off by name in every project, also ones found at runtime', () => {
    const config = new McpConfig(box.project);
    config.setEnabled({ name: 'claude.ai Gmail' }, false);
    config.setEnabled({ name: 'context7', source: 'claude' }, false);
    expect(loadSettings().mcp?.disabled).toEqual(['claude.ai Gmail', 'context7']);
    expect(config.isEnabled({ name: 'context7', source: 'claude' })).toBe(false);

    config.setEnabled({ name: 'claude.ai Gmail' }, true);
    expect(config.disabled()).toEqual(['context7']);
  });
});
