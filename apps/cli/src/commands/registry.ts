import { fuzzyFilter, type CompletionSource } from '@jinion/tui';
import type { Jinion } from '../context.js';

/** One of Jinion's own commands. The agent's skills and MCP prompts are mentioned with `$` instead (`skills.ts`). */
export interface Command {
  name: string;
  description: string;
  aliases?: string[];
  /** `<required>` or `[optional]`; a required argument makes Enter in the palette insert instead of run. */
  argumentHint?: string;
  run(app: Jinion, args: string): void;
}

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
          insert: `/${item.name} `,
          submit: item.argumentHint?.startsWith('<') ? false : undefined,
        })),
      };
    };
  }
}
