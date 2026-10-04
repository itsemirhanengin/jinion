import { demoCommands } from '../commands.js';
import type { Scenario } from '../types.js';

const MENTIONED = new RegExp(`(?<=^|\\s)\\$(${demoCommands.map((command) => command.name).join('|')})(?=$|\\s)`, 'g');

export const agentCommand: Scenario = {
  title: (prompt) => `Use ${[...prompt.matchAll(MENTIONED)].map((match) => match[0]).join(', ')}`,
  // Without the `g` flag, which would make `test` remember where it stopped.
  match: new RegExp(MENTIONED.source),
  async *play(script, prompt) {
    const commands = [...prompt.matchAll(MENTIONED)].map((match) => demoCommands.find((command) => command.name === match[1])!);
    const rest = prompt.replace(MENTIONED, '').replace(/\s+/g, ' ').trim();

    for (const command of commands) {
      const mcp = command.source === 'mcp';

      yield* script.think(
        mcp
          ? `The user picked the ${command.name} prompt from the ${command.group} MCP server. I will fetch it and follow what it returns.`
          : `The user picked the ${command.name} skill. I will load its instructions before doing anything.`,
      );

      yield* script.tool(
        'read',
        { files: [{ path: mcp ? `mcp://${command.group}/prompts/${command.name}` : `.claude/skills/${command.name}/SKILL.md` }] },
        {},
        500,
      );
    }

    yield* script.usage(1_100, 0.003);

    const names = commands.map((command) => `\`$${command.name}\``).join(' and ');

    yield* script.say(
      `This is the scripted demo agent, so ${names} ${commands.length > 1 ? 'stop' : 'stops'} here${rest ? ` (the rest of the message: \`${rest}\`)` : ''}. A real agent would now follow what it loaded.`,
    );
  },
};
