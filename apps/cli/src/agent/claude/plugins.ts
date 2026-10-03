import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { SdkPluginConfig } from '@anthropic-ai/claude-agent-sdk';
import { readJson } from '../../lib/json-file.js';
import { jinionHome, projectDir } from '../../lib/paths.js';
import { claudeConfigDir } from './paths.js';

export const SKILL_PLUGINS = ['user', 'project'] as const;

export function skillLabel(name: string) {
  const scope = SKILL_PLUGINS.find((plugin) => name.startsWith(`${plugin}:`));
  return scope ? name.slice(scope.length + 1) : name;
}

/** Skills of Claude Code's own plugins, about Claude Code itself; `disableBundledSkills` turns off the rest. */
export const CLAUDE_CODE_SKILLS = ['design', 'doctor', 'plugin-authoring'];

/** Claude Code reads no skills folders while its settings are off, so they go in as plugins. The first folder wins a name. */
export function skillPlugins(cwd: string): SdkPluginConfig[] {
  const scopes: [(typeof SKILL_PLUGINS)[number], string, string[]][] = [
    ['user', join(jinionHome(), 'plugins', 'user'), [join(claudeConfigDir(), 'skills'), join(homedir(), '.agents', 'skills')]],
    ['project', join(projectDir(cwd), 'plugins', 'project'), [join(cwd, '.claude', 'skills'), join(cwd, '.agents', 'skills')]],
  ];
  return scopes.flatMap(([name, root, folders]) => {
    const skills = new Map<string, string>();
    for (const folder of folders) {
      for (const entry of existsSync(folder) ? readdirSync(folder) : []) {
        const path = join(folder, entry);
        if (!skills.has(entry) && existsSync(join(path, 'SKILL.md'))) skills.set(entry, path);
      }
    }
    if (skills.size === 0) return [];
    linkSkills(root, name, skills);
    return [{ type: 'local' as const, path: root }];
  });
}

/** Touches only links, so two Jinions can do it at once. */
function linkSkills(root: string, name: string, skills: Map<string, string>) {
  const folder = join(root, 'skills');
  mkdirSync(join(root, '.claude-plugin'), { recursive: true });
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(root, '.claude-plugin', 'plugin.json'), `${JSON.stringify({ name, description: `Your ${name} skills` })}\n`);
  for (const entry of readdirSync(folder)) {
    const path = join(folder, entry);
    if (lstatSync(path).isSymbolicLink() && readlinkSync(path) !== skills.get(entry)) unlinkSync(path);
  }
  for (const [entry, target] of skills) {
    try {
      symlinkSync(target, join(folder, entry));
    } catch {
      // Already linked.
    }
  }
}

type PluginSettings = { enabledPlugins?: Record<string, boolean> };

/** Their hooks stay off, since they would add context of their own to every conversation. */
export function claudePlugins(cwd: string): SdkPluginConfig[] {
  const config = claudeConfigDir();
  const enabled: Record<string, boolean> = {};
  for (const file of [join(config, 'settings.json'), join(cwd, '.claude', 'settings.json'), join(cwd, '.claude', 'settings.local.json')]) {
    Object.assign(enabled, readJson<PluginSettings>(file, {}).enabledPlugins);
  }
  const installed = readJson<{ plugins?: Record<string, { installPath?: string }[]> }>(
    join(config, 'plugins', 'installed_plugins.json'),
    {},
  ).plugins;
  return Object.entries(enabled).flatMap(([id, on]) => {
    const path = on ? installed?.[id]?.[0]?.installPath : undefined;
    return path && existsSync(path) ? [{ type: 'local' as const, path }] : [];
  });
}
