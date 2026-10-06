import type { AgentCommand } from '@jinion/core/agent/agent';
import type { Initialized } from '@jinion/core/api/schemas';
import { commandCompletion } from '@jinion/core/prompt/command-completion';
import type { CompletionSource } from '@jinion/core/prompt/completion';
import { fileCompletion } from '@jinion/core/prompt/file-completion';
import { skillCompletion } from '@jinion/core/prompt/skills';

/** What only means something in a terminal; `/exit` would stop the project's core. */
const TERMINAL_ONLY = new Set(['statusline', 'expand', 'exit']);

/** `/` lists Jinion's commands, then the skills, which go in as `$name` since the core runs them from anywhere in a message. */
export function completions(commands: Initialized['commands'], skills: AgentCommand[], files: string[]): CompletionSource[] {
  return [slashCompletion(commands, skills), skillCompletion(skills), fileCompletion(files)];
}

function slashCompletion(commands: Initialized['commands'], skills: AgentCommand[]): CompletionSource {
  const forCommands = commandCompletion(commands.filter((command) => !TERMINAL_ONLY.has(command.name)));
  const forSkills = skillCompletion(skills);

  return (value, cursor) => {
    const listed = forCommands(value, cursor);
    if (!listed) return undefined;

    const query = value.slice(1);
    const skillItems = forSkills(`$${query}`, query.length + 1)?.items ?? [];

    return {
      ...listed,
      items: [
        ...listed.items.map((item) => ({ ...item, group: 'Commands' })),
        ...skillItems.map((item) => ({ ...item, label: `$${item.label}`, submit: false })),
      ],
    };
  };
}
