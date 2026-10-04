import { join } from 'node:path';
import type { CanUseTool, PermissionRuleValue } from '@anthropic-ai/claude-agent-sdk';
import type { PermissionRequest } from '../permissions.js';
import { readJson, writeJson } from '../../lib/json-file.js';
import { projectDir } from '../../lib/paths.js';
import { GUARD_REASONS } from './guard.js';
import type { Input } from './input.js';
import { within } from './paths.js';
import { toolTitle } from './tool-names.js';

type RequestOptions = Parameters<CanUseTool>[2];

/** Claude Code suggests no rule where one would be unsafe or useless, e.g. under an ask rule; then "don't ask again" isn't offered. */
export function alwaysRules(options: RequestOptions): PermissionRuleValue[] {
  // Jinion's guard runs before any rule, so a saved rule would never stop it from asking.
  const guarded = options.decisionReason !== undefined && GUARD_REASONS.has(options.decisionReason);
  if (options.suppressAlwaysAllowRule || options.matchedAskRule || guarded) return [];

  return (options.suggestions ?? []).flatMap((update) =>
    update.type === 'addRules' && update.behavior === 'allow' ? update.rules : [],
  );
}

export function toPermissionRequest(
  name: string,
  input: Input,
  options: RequestOptions,
  always: PermissionRuleValue[],
  cwd: string,
): PermissionRequest {
  const command = name === 'Bash' && typeof input.command === 'string' ? input.command : undefined;
  const target = [input.file_path, input.url, input.path].find((value) => typeof value === 'string') as string | undefined;

  const description = [
    options.decisionReason && GUARD_REASONS.has(options.decisionReason) ? options.decisionReason : undefined,
    command ? (input.description as string | undefined) : options.description,
    options.blockedPath && blockedPathLabel(options.blockedPath, cwd),
    options.agentID && 'Asked by a subagent',
  ].filter((part) => part && part !== target);

  return {
    title: (options.title ?? defaultTitle(name)).replace(/^Claude\b/, 'jinion'),
    command,
    subject: command ? undefined : target,
    description: description.length > 0 ? description.join(' · ') : undefined,
    always: always.length > 0 ? always.map(ruleLabel).join(', ') : undefined,
    defaultToNo: options.defaultToNo,
  };
}

export const formatRule = (rule: PermissionRuleValue) =>
  rule.ruleContent === undefined ? rule.toolName : `${rule.toolName}(${rule.ruleContent})`;

function ruleLabel(rule: PermissionRuleValue) {
  if (rule.toolName === 'Bash' && rule.ruleContent) return `\`${rule.ruleContent}\``;

  return rule.ruleContent === undefined ? toolTitle(rule.toolName) : formatRule(rule);
}

function blockedPathLabel(path: string, cwd: string) {
  const relative = within(path, cwd);

  return relative === undefined ? `Outside the project: ${path}` : `Changes ${relative || '.'} in the project`;
}

function defaultTitle(name: string) {
  if (name === 'Bash') return 'jinion wants to run a command';
  if (name === 'Edit' || name === 'Write') return 'jinion wants to change a file';

  return `jinion wants to use ${toolTitle(name)}`;
}

export class ProjectPermissions {
  private readonly file: string;

  constructor(cwd: string) {
    this.file = join(projectDir(cwd), 'permissions.json');
  }

  list(): string[] {
    return readJson<string[]>(this.file, []);
  }

  add(rules: string[]) {
    writeJson(this.file, [...new Set([...this.list(), ...rules])]);
  }
}
