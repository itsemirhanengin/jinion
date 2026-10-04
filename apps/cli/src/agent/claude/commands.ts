import type { SDKUserMessage, SlashCommand } from '@anthropic-ai/claude-agent-sdk';
import type { AgentCommand, AgentPrompt } from '../agent.js';
import { labelOf } from './mcp.js';

/** Claude Code lists an MCP prompt as `claude.ai Figma:create_rules (MCP)`, and runs it as `/mcp__claude_ai_Figma__create_rules`. */
const MCP_PROMPT = /^(.+):([^:]+) \(MCP\)$/;

const PRECEDENCE = ['project', 'user', 'plugin', 'mcp'] as const;

export type Invocations = Map<string, string>;

/** Each gets its short name, `design` for `user:design`, unless one that comes first already has it. */
export function toAgentCommands(list: SlashCommand[]) {
  const entries = list
    .filter((command) => !command.builtin)
    .map((command) => {
      const prompt = MCP_PROMPT.exec(command.name);

      if (prompt) {
        const server = labelOf(prompt[1]!).replace(/\s+/g, '-');
        const kind = 'mcp' as const;

        return { command, kind, group: server, short: prompt[2]!, full: `${server}:${prompt[2]}`, target: `mcp__${normalized(prompt[1]!)}__${prompt[2]}` };
      }

      const colon = command.name.indexOf(':');
      const plugin = colon === -1 ? undefined : command.name.slice(0, colon);
      const kind: (typeof PRECEDENCE)[number] = plugin === 'project' || plugin === 'user' ? plugin : 'plugin';
      const short = colon === -1 ? command.name : command.name.slice(colon + 1);

      const group = plugin === 'claude-ai' ? 'claude.ai' : (plugin ?? 'plugin');

      return { command, kind, group, short, full: command.name, target: command.name };
    })
    .sort((a, b) => PRECEDENCE.indexOf(a.kind) - PRECEDENCE.indexOf(b.kind));

  const invocations: Invocations = new Map();
  const commands: AgentCommand[] = [];

  for (const { command, kind, group, short, full, target } of entries) {
    const name = invocations.has(short) ? full : short;
    if (invocations.has(name) || /\s/.test(name)) continue;

    invocations.set(name, target);

    commands.push({
      name,
      // Claude Code puts a plugin's name before its skills' descriptions; the pickers show it as the group instead.
      description: command.description.replace(/^\([^)]+\) /, ''),
      source: kind === 'mcp' ? 'mcp' : 'skill',
      group,
      argumentHint: command.argumentHint || undefined,
    });
  }

  return { commands, invocations };
}

/** Images go after the text, so a slash command at the start of it still reads as one. */
export function toClaudeContent(prompt: AgentPrompt, invocations: Invocations): SDKUserMessage['message']['content'] {
  const text = toClaudePrompt(prompt.text, invocations);
  if (!prompt.images?.length) return text;

  return [
    { type: 'text', text },
    ...prompt.images.map((image) => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: image.mediaType as 'image/png', data: image.data },
    })),
  ];
}

const MENTIONED = /(?<=^|\s)\$([\w.:-]*[\w-])/g;

/** Claude Code runs a skill or MCP prompt only as a slash command at the start; other skills get a note to load them. */
export function toClaudePrompt(prompt: string, invocations: Invocations) {
  const mentioned = [...prompt.matchAll(MENTIONED)].flatMap((match) => {
    const target = invocations.get(match[1]!);

    return target ? [{ name: match[1]!, target, index: match.index, length: match[0].length }] : [];
  });
  if (mentioned.length === 0) return prompt;

  const without = (mention: (typeof mentioned)[number]) =>
    `${prompt.slice(0, mention.index)}${prompt.slice(mention.index + mention.length)}`.replace(/\s+/g, ' ').trim();

  const mcp = mentioned.find((mention) => mention.target.startsWith('mcp__'));
  const skills = mentioned.filter((mention) => !mention.target.startsWith('mcp__'));
  if (!mcp && skills.length === 1 && skills[0]!.index === 0) return `/${skills[0]!.target}${prompt.slice(skills[0]!.length)}`;

  const text = mcp ? `/${mcp.target} ${without(mcp)}`.trimEnd() : prompt;
  if (skills.length === 0) return text;

  const list = skills.map((skill) => `$${skill.name} is ${skill.target}`).join(', ');

  return `${text}\n\n<system-reminder>The user picked skills for this request with $: ${list}. Load each with the Skill tool before you start.</system-reminder>`;
}

const normalized = (server: string) => server.replace(/[^a-zA-Z0-9_-]/g, '_');
