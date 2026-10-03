import { describe, expect, it } from 'vitest';
import type { AgentCommand } from '../../src/agent/agent.js';
import { skillCompletion, skillGroup } from '../../src/prompt/skills.js';

const skill = (name: string, group: string, source: AgentCommand['source'] = 'skill'): AgentCommand => ({
  name,
  description: name,
  source,
  group,
});

const SKILLS = [
  skill('nextjs', 'vercel'),
  skill('react-best-practices', 'vercel'),
  skill('design', 'user'),
  skill('make-responsive', 'user'),
  skill('hello', 'project'),
  skill('create_rules', 'Figma', 'mcp'),
];

const complete = (value: string) => skillCompletion(SKILLS)(value, value.length);
const rows = (value: string) => complete(value)?.items.map((item) => `${item.group} ${item.label}`);

describe('skillCompletion', () => {
  it('lists every skill after $, grouped: the project’s, the user’s, plugins’, then MCP prompts', () => {
    expect(rows('use $')).toEqual([
      'Project hello',
      'Yours design',
      'Yours make-responsive',
      'vercel nextjs',
      'vercel react-best-practices',
      'Figma prompts create_rules',
    ]);
  });

  it('puts the group with the best match first while typing', () => {
    expect(rows('$next')).toEqual(['vercel nextjs']);
    expect(rows('$resp')![0]).toBe('Yours make-responsive');
  });

  it('replaces the typed mention and keeps Enter for inserting', () => {
    const completion = complete('fix it $des')!;

    expect(completion).toMatchObject({ from: 7, to: 11, submit: false });
    expect(completion.items[0]!.insert).toBe('$design ');
  });

  it('closes on a name typed in full, and ignores $ inside words', () => {
    expect(complete('$design')).toBeUndefined();
    expect(complete('cost5$')).toBeUndefined();
  });
});

describe('skillGroup', () => {
  it('names the groups', () => {
    expect(SKILLS.map(skillGroup)).toEqual(['vercel', 'vercel', 'Yours', 'Yours', 'Project', 'Figma prompts']);
  });
});
