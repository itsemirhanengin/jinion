import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { beforeAll, describe, expect, it } from 'vitest';
import type { AgentEvent } from '../types.js';
import { ClaudeEvents } from './events.js';

/**
 * Real conversations with Claude Code, recorded with `--debug` and turned into fixtures with `pnpm fixture`, played
 * through the mapper. The fixtures say `/project` for the project and `/home/user` for the home folder.
 */
beforeAll(() => {
  process.env.HOME = '/home/user';
  process.env.JINION_HOME = '/home/user/.jinion';
});

function replay(name: string) {
  const events = new ClaudeEvents('/project');
  return readFileSync(join(import.meta.dirname, 'fixtures', `${name}.jsonl`), 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => [...events.map(JSON.parse(line) as SDKMessage)]);
}

/** One line per event, with streamed text joined and tool ids numbered, so a snapshot reads like the conversation. */
function transcript(events: AgentEvent[]) {
  const ids = new Map<string, string>();
  const id = (raw: string) => {
    if (!ids.has(raw)) ids.set(raw, `t${ids.size + 1}`);
    return ids.get(raw)!;
  };
  const lines: string[] = [];
  for (const event of events) {
    const last = lines.at(-1);
    switch (event.type) {
      case 'text':
      case 'thinking':
        if (last?.startsWith(`${event.type}: `)) lines[lines.length - 1] = last + event.delta;
        else lines.push(`${event.type}: ${event.delta}`);
        break;
      case 'tool-start':
        lines.push(`start ${id(event.id)} ${event.call.name} ${JSON.stringify(event.call.input)}`);
        break;
      case 'tool-output':
        lines.push(`output ${id(event.id)} ${JSON.stringify(event.lines)}`);
        break;
      case 'tool-end': {
        // Durations differ from run to run.
        const result = event.result && 'wallMs' in event.result ? { ...event.result, wallMs: 0 } : event.result;
        lines.push(`end ${id(event.id)} ${event.ok ? 'ok' : 'failed'} ${JSON.stringify(result ?? {})}`);
        break;
      }
      case 'usage': {
        const line = `usage ${event.usage.contextTokens}/${event.usage.contextWindow} $${event.usage.cost.toFixed(4)}`;
        if (line !== last) lines.push(line);
        break;
      }
      case 'limits':
        lines.push(`limits ${event.windows.map((window) => window.label).join(', ')}`);
        break;
      case 'session':
        lines.push('session');
        break;
      case 'mode':
        if (`mode ${event.mode}` !== last) lines.push(`mode ${event.mode}`);
        break;
      case 'title':
        lines.push(`title ${event.title}`);
        break;
    }
  }
  return lines;
}

const started = (events: AgentEvent[]) =>
  events.flatMap((event) => (event.type === 'tool-start' ? [event.call] : []));

describe('ClaudeEvents replaying recorded conversations', () => {
  for (const name of ['tools', 'plan', 'skills', 'interrupt']) {
    it(`maps the ${name} conversation as before`, () => {
      expect(transcript(replay(name))).toMatchSnapshot();
    });
  }

  it('shows tasks, reads, edits with real line numbers, commands and answers', () => {
    const events = replay('tools');
    const calls = started(events);
    const todos = calls.filter((call) => call.name === 'todo').at(-1);
    expect(todos!.input.groups[0]!.items.map((item) => item.status)).toEqual(['done', 'done']);
    expect(calls.map((call) => call.name)).toEqual(expect.arrayContaining(['read', 'edit', 'bash', 'ask']));
    const edits = events.flatMap((event) => (event.type === 'tool-end' && event.result && 'patch' in event.result ? [event.result.patch] : []));
    expect(edits[0]).toMatch(/^@@ -\d+,\d+ \+\d+,\d+ @@/);
    const answer = events.find((event) => event.type === 'tool-end' && event.result && 'answers' in event.result);
    expect(answer).toMatchObject({ result: { answers: [{ options: [0] }] } });
  });

  it('shows the plan from Claude Code’s plan file, without showing the file being written', () => {
    const calls = started(replay('plan'));
    const plan = calls.find((call) => call.name === 'plan');
    expect(plan?.input.plan).toMatch(/^# Plan/);
    expect(calls.some((call) => call.name === 'edit' && call.input.path.includes('/.claude/plans/'))).toBe(false);
  });

  it('names skills, tool loading and MCP tools the way the user reads them', () => {
    const titles = started(replay('skills')).flatMap((call) => (call.name === 'other' ? [`${call.input.title}: ${call.input.detail}`] : []));
    expect(titles).toEqual(
      expect.arrayContaining(['Skill: explain-math', 'Load tools: context7:resolve-library-id', expect.stringMatching(/^context7:resolve-library-id/)]),
    );
  });

  it('ends an interrupted turn without a result of its own and carries on with the next', () => {
    const lines = transcript(replay('interrupt'));
    expect(lines.filter((line) => line === 'session')).toHaveLength(2);
    expect(lines.filter((line) => line.startsWith('text: ')).at(-1)).toMatch(/OK/);
  });
});
