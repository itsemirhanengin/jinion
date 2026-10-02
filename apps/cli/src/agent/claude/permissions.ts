import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { CanUseTool, PermissionRuleValue } from '@anthropic-ai/claude-agent-sdk';
import type { PermissionRequest } from '@jinion/tui';
import { toolTitle } from './events.js';

type Input = Record<string, unknown>;
type RequestOptions = Parameters<CanUseTool>[2];

const FILE = join(process.env.JINION_HOME ?? join(homedir(), '.jinion'), 'permissions.json');

/**
 * What "don't ask again" would allow: the rules Claude Code suggests, such as `Bash(pnpm add *)`. It suggests none
 * where a rule would be unsafe or useless, e.g. for commands caught by an ask rule, and then the choice isn't offered.
 */
export function alwaysRules(options: RequestOptions): PermissionRuleValue[] {
  if (options.suppressAlwaysAllowRule || options.matchedAskRule) return [];
  return (options.suggestions ?? []).flatMap((update) =>
    update.type === 'addRules' && update.behavior === 'allow' ? update.rules : [],
  );
}

export function toPermissionRequest(
  name: string,
  input: Input,
  options: RequestOptions,
  always: PermissionRuleValue[],
): PermissionRequest {
  const command = name === 'Bash' && typeof input.command === 'string' ? input.command : undefined;
  const target = [input.file_path, input.url, input.path].find((value) => typeof value === 'string') as string | undefined;
  const description = [
    command ? (input.description as string | undefined) : options.description,
    options.blockedPath && `Outside the project: ${options.blockedPath}`,
    options.agentID && 'Asked by a subagent',
  ].filter(Boolean);

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

function defaultTitle(name: string) {
  if (name === 'Bash') return 'jinion wants to run a command';
  if (name === 'Edit' || name === 'Write') return 'jinion wants to change a file';
  return `jinion wants to use ${toolTitle(name)}`;
}

/** "Don't ask again" answers, kept per project as Claude Code permission rules such as `Bash(pnpm add:*)`. */
export class ProjectPermissions {
  constructor(
    private readonly project: string,
    private readonly file = FILE,
  ) {}

  list(): string[] {
    return this.read()[this.project] ?? [];
  }

  add(rules: string[]) {
    const all = this.read();
    all[this.project] = [...new Set([...(all[this.project] ?? []), ...rules])];
    mkdirSync(dirname(this.file), { recursive: true });
    writeFileSync(this.file, `${JSON.stringify(all, null, 2)}\n`);
  }

  private read(): Record<string, string[]> {
    if (!existsSync(this.file)) return {};
    try {
      return JSON.parse(readFileSync(this.file, 'utf8')) as Record<string, string[]>;
    } catch {
      return {};
    }
  }
}
