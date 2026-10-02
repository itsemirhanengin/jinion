import { fuzzyFilter, type CompletionSource } from '@jinion/tui';
import type { AgentCommand } from '../agent/types.js';
import type { Jinion } from '../context.js';

export type CommandSource = 'builtin' | 'skill' | 'mcp';

export interface Command {
  name: string;
  description: string;
  source: CommandSource;
  aliases?: string[];
  /** `<required>` or `[optional]`; a required argument makes Enter in the palette insert instead of run. */
  argumentHint?: string;
  run(app: Jinion, args: string): void;
}

/** Display order and labels, shared by the palette tags and the help tabs. */
export const COMMAND_SOURCES: Record<CommandSource, { label: string; tag?: string }> = {
  builtin: { label: 'Commands' },
  skill: { label: 'Skills', tag: 'skill' },
  mcp: { label: 'MCP', tag: 'mcp' },
};

export class CommandRegistry {
  constructor(private readonly commands: Command[]) {
    const names = new Set<string>();
    for (const name of commands.flatMap((command) => [command.name, ...(command.aliases ?? [])])) {
      if (names.has(name)) throw new Error(`Two commands are registered as /${name}.`);
      names.add(name);
    }
  }

  list() {
    return this.commands;
  }

  find(name: string) {
    return this.commands.find((command) => command.name === name || command.aliases?.includes(name));
  }

  /** Commands grouped by source, in `COMMAND_SOURCES` order, skipping empty groups. */
  groups() {
    return (Object.keys(COMMAND_SOURCES) as CommandSource[])
      .map((source) => ({
        source,
        label: COMMAND_SOURCES[source].label,
        commands: this.commands.filter((command) => command.source === source),
      }))
      .filter((group) => group.commands.length > 0);
  }

  /** Completes `/name` at the start of the prompt, until the first space. */
  completion(): CompletionSource {
    return (value) => {
      if (!value.startsWith('/') || /\s/.test(value)) return undefined;
      const matches = fuzzyFilter(this.commands, value.slice(1), (command) => command.name);
      return {
        from: 0,
        to: value.length,
        submit: true,
        items: matches.map(({ item, positions }) => ({
          key: item.name,
          label: `/${item.name}`,
          positions: positions.map((position) => position + 1),
          hint: item.argumentHint,
          description: item.description,
          tag: COMMAND_SOURCES[item.source].tag,
          insert: `/${item.name} `,
          submit: item.argumentHint?.startsWith('<') ? false : undefined,
        })),
      };
    };
  }
}

/** Skills and MCP prompts run by sending `/name args` to the agent. */
export function agentCommands(commands: AgentCommand[]): Command[] {
  return commands.map((command) => ({
    ...command,
    run: (app, args) => app.actions.prompt(args ? `/${command.name} ${args}` : `/${command.name}`),
  }));
}
