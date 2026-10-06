import { z } from 'zod';
import type { Jinion } from '../controllers/jinion.js';

/** What a command is, without running it, as a client lists it. */
export const CommandInfo = z.object({
  name: z.string(),
  description: z.string(),
  aliases: z.array(z.string()).optional(),
  /** `<required>` or `[optional]`; a required argument makes Enter in the palette insert instead of run. */
  argumentHint: z.string().optional(),
});

export type CommandInfo = z.infer<typeof CommandInfo>;

export interface Command extends CommandInfo {
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
}
