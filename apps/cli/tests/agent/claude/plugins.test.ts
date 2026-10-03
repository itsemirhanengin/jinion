import { existsSync, readFileSync, readlinkSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sandboxEach } from '../../support/sandbox.js';
import { claudePlugins, skillLabel, skillPlugins } from '../../../src/agent/claude/plugins.js';

const box = sandboxEach();

const skill = (folder: string, name: string) =>
  box.write(join(folder, name, 'SKILL.md'), `---\nname: ${name}\ndescription: ${name}\n---\n`).replace(/\/SKILL\.md$/, '');

describe('skillPlugins', () => {
  it('makes nothing when there are no skills', () => {
    expect(skillPlugins(box.project)).toEqual([]);
  });

  it('links each skill into a plugin per scope, Claude Code’s folder first', () => {
    const design = skill(join(box.home, '.claude', 'skills'), 'design');
    const ideas = skill(join(box.home, '.agents', 'skills'), 'ideas');
    const hello = skill(join(box.project, '.claude', 'skills'), 'hello');

    skill(join(box.home, '.agents', 'skills'), 'design');
    box.write(join(box.home, '.claude', 'skills', 'notes', 'README.md'), 'not a skill');

    const plugins = skillPlugins(box.project);
    const [user, project] = plugins.map((plugin) => plugin.path);

    expect(plugins).toHaveLength(2);
    expect(JSON.parse(readFileSync(join(user!, '.claude-plugin', 'plugin.json'), 'utf8')).name).toBe('user');
    expect(readdirSync(join(user!, 'skills')).sort()).toEqual(['design', 'ideas']);
    expect(readlinkSync(join(user!, 'skills', 'design'))).toBe(design);
    expect(readlinkSync(join(user!, 'skills', 'ideas'))).toBe(ideas);
    expect(readlinkSync(join(project!, 'skills', 'hello'))).toBe(hello);
  });

  it('drops the links of skills that are gone', () => {
    const skills = join(box.home, '.claude', 'skills');

    skill(skills, 'design');
    skill(skills, 'ideas');
    const [user] = skillPlugins(box.project).map((plugin) => plugin.path);

    rmSync(join(skills, 'ideas'), { recursive: true });
    skillPlugins(box.project);

    expect(readdirSync(join(user!, 'skills'))).toEqual(['design']);
  });
});

describe('claudePlugins', () => {
  it('loads the plugins turned on in Claude Code that are installed', () => {
    const vercel = join(box.home, 'cache', 'vercel');

    box.write(join(vercel, '.claude-plugin', 'plugin.json'), { name: 'vercel' });

    box.write(join(box.home, '.claude', 'settings.json'), {
      enabledPlugins: { 'vercel@official': true, 'figma@official': true, 'warp@other': false },
    });

    box.write(join(box.home, '.claude', 'plugins', 'installed_plugins.json'), {
      plugins: {
        'vercel@official': [{ installPath: vercel }],
        'figma@official': [{ installPath: join(box.home, 'cache', 'missing') }],
        'warp@other': [{ installPath: vercel }],
      },
    });

    expect(claudePlugins(box.project)).toEqual([{ type: 'local', path: vercel }]);
  });

  it('lets the project turn a plugin off', () => {
    const vercel = join(box.home, 'cache', 'vercel');

    box.write(join(vercel, 'README.md'), 'plugin');
    box.write(join(box.home, '.claude', 'settings.json'), { enabledPlugins: { 'vercel@official': true } });
    box.write(join(box.project, '.claude', 'settings.local.json'), { enabledPlugins: { 'vercel@official': false } });

    box.write(join(box.home, '.claude', 'plugins', 'installed_plugins.json'), {
      plugins: { 'vercel@official': [{ installPath: vercel }] },
    });

    expect(existsSync(vercel)).toBe(true);
    expect(claudePlugins(box.project)).toEqual([]);
  });
});

describe('skillLabel', () => {
  it('drops Jinion’s own plugin names only', () => {
    expect(skillLabel('user:design')).toBe('design');
    expect(skillLabel('project:hello')).toBe('hello');
    expect(skillLabel('vercel:nextjs')).toBe('vercel:nextjs');
  });
});
