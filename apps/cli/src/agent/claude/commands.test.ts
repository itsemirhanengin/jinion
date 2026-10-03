import type { SlashCommand } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { toAgentCommands, toClaudePrompt } from './commands.js';

const command = (name: string, description = name): SlashCommand => ({ name, description, argumentHint: '' });

describe('toAgentCommands', () => {
  const { commands, invocations } = toAgentCommands([
    { ...command('compact'), builtin: true },
    command('user:design', '(user) Design guidelines'),
    command('project:design', '(project) This project’s design rules'),
    command('vercel:nextjs', '(vercel) Next.js guidance'),
    command('vercel:design'),
    command('claude.ai Figma:create_rules (MCP)', 'Rules for Figma'),
    command('plugin:vercel:vercel:deploy (MCP)'),
  ]);
  const byName = Object.fromEntries(commands.map((entry) => [entry.name, entry]));

  it('leaves out Claude Code’s own commands', () => {
    expect(byName.compact).toBeUndefined();
  });

  it('gives the short name to the project, then the user, then plugins', () => {
    expect(invocations.get('design')).toBe('project:design');
    expect(invocations.get('user:design')).toBe('user:design');
    expect(invocations.get('vercel:design')).toBe('vercel:design');
    expect(invocations.get('nextjs')).toBe('vercel:nextjs');
  });

  it('groups by where they come from, without the plugin in the description', () => {
    expect(byName.nextjs).toMatchObject({ source: 'skill', group: 'vercel', description: 'Next.js guidance' });
    expect(byName['user:design']).toMatchObject({ group: 'user', description: 'Design guidelines' });
  });

  it('runs MCP prompts by their Claude Code command name', () => {
    expect(byName.create_rules).toMatchObject({ source: 'mcp', group: 'Figma' });
    expect(invocations.get('create_rules')).toBe('mcp__claude_ai_Figma__create_rules');
    expect(invocations.get('deploy')).toBe('mcp__plugin_vercel_vercel__deploy');
  });
});

describe('toClaudePrompt', () => {
  const invocations = new Map([
    ['design', 'user:design'],
    ['nextjs', 'vercel:nextjs'],
    ['create_rules', 'mcp__claude_ai_Figma__create_rules'],
  ]);

  it('sends prompts without known mentions as they are', () => {
    expect(toClaudePrompt('echo $HOME', invocations)).toBe('echo $HOME');
  });

  it('runs a leading single skill as its slash command', () => {
    expect(toClaudePrompt('$design the login page', invocations)).toBe('/user:design the login page');
  });

  it('asks the agent to load skills mentioned elsewhere or together', () => {
    const prompt = toClaudePrompt('fix the navbar $design, then $nextjs', invocations);
    expect(prompt).toMatch(/^fix the navbar \$design, then \$nextjs\n\n<system-reminder>/);
    expect(prompt).toContain('$design is user:design, $nextjs is vercel:nextjs');
  });

  it('moves an MCP prompt to the front with the rest as its arguments', () => {
    expect(toClaudePrompt('for the header $create_rules please', invocations)).toBe(
      '/mcp__claude_ai_Figma__create_rules for the header please',
    );
  });
});
