import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type { MemoryStore } from '../../memory/store.js';
import { memoryTools } from '../../memory/tools.js';
import type { Terminals } from '../../terminals/terminals.js';
import { type TerminalAction, terminalTools } from '../../terminals/tools.js';

export const JINION_SERVER = 'jinion';

export const isJinionTool = (name: string) => name.startsWith(`mcp__${JINION_SERVER}__`);

/** Jinion's tool as Claude Code names it. */
export const jinionTool = (name: string) => `mcp__${JINION_SERVER}__${name}`;

/** The one of Jinion's tools that changes something, so it is asked about as a command is. */
export const RUN_IN_TERMINAL = jinionTool('run_in_terminal' satisfies TerminalAction);

export interface JinionTools {
  memory?: MemoryStore;
  terminals?: Terminals;
  /** Where the conversation works, where a command started in a terminal runs. */
  cwd: string;
}

export function jinionServer({ memory, terminals, cwd }: JinionTools) {
  const notes = memory && memoryTools(memory);
  const shells = terminals && terminalTools(terminals, () => cwd);

  return createSdkMcpServer({
    name: JINION_SERVER,
    version: '0.1.0',
    // The prompt counts on these tools, so they are never deferred behind ToolSearch like other MCP tools.
    alwaysLoad: true,
    tools: [
      ...(notes
        ? [
            tool('remember', notes.remember.description, notes.remember.input, async (note) => text(notes.remember.run(note))),
            tool('recall', notes.recall.description, notes.recall.input, async (input) => text(notes.recall.run(input))),
            tool('forget', notes.forget.description, notes.forget.input, async (input) => text(notes.forget.run(input))),
          ]
        : []),
      ...(shells
        ? [
            tool('terminals', shells.terminals.description, shells.terminals.input, async () => text(await shells.terminals.run({}))),
            tool('read_terminal', shells.read_terminal.description, shells.read_terminal.input, async (input) => text(await shells.read_terminal.run(input))),
            tool('run_in_terminal', shells.run_in_terminal.description, shells.run_in_terminal.input, async (input) => text(await shells.run_in_terminal.run(input))),
          ]
        : []),
    ],
  });
}

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });
