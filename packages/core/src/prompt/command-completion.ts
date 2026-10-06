import type { CommandInfo } from '../commands/registry.js';
import { fuzzyFilter } from '../lib/fuzzy.js';
import type { CompletionSource } from './completion.js';

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
