import { fuzzyFilter } from '../lib/fuzzy.js';
import type { CompletionSource } from '../prompt/completion.js';
import type { Jinion } from '../controllers/jinion.js';

export interface Command {
  name: string;
  description: string;
  aliases?: string[];
  /** `<required>` or `[optional]`; a required argument makes Enter in the palette insert instead of run. */
  argumentHint?: string;
  run(jinion: Jinion, args: string): void;
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

  completion(): CompletionSource {
    return commandCompletion(this.commands);
  }
}

/** What a command is, without running it, as a client lists it. */
export type CommandInfo = Omit<Command, 'run'>;

export const requiresArgument = (command: CommandInfo) => command.argumentHint?.startsWith('<') === true;

/** Commands after a `/` at the start of the prompt. */
export function commandCompletion(commands: CommandInfo[]): CompletionSource {
  return (value) => {
    if (!value.startsWith('/') || /\s/.test(value)) return undefined;

    const matches = fuzzyFilter(commands, value.slice(1), (command) => command.name);

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
        submit: requiresArgument(item) ? false : undefined,
      })),
    };
  };
}
