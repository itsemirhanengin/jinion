import { z } from 'zod';
import { memorySection } from '../../memory/prompt.js';
import type { MemoryStore } from '../../memory/store.js';
import { type MemoryAction, memoryTools } from '../../memory/tools.js';
import type { Terminals } from '../../terminals/terminals.js';
import { TERMINAL_ACTIONS, type TerminalAction, terminalTools } from '../../terminals/tools.js';

/** Jinion's notes and terminals come as tools of their own, apart from Codex's memories and commands. */
export const JINION_NAMESPACE = 'jinion';

export const MEMORY_TOOLS: Record<string, MemoryAction> = { remember: 'remember', recall: 'recall', forget: 'forget' };

export const isTerminalTool = (name: string): name is TerminalAction => TERMINAL_ACTIONS.has(name);

export interface JinionTools {
  memory?: MemoryStore;
  terminals?: Terminals;
  /** Where the conversation works, where a command started in a terminal runs. */
  cwd: () => string;
}

/** The tools as Codex takes them when a conversation starts; none without a store or terminals to back them. */
export function jinionToolSpecs({ memory, terminals, cwd }: JinionTools) {
  const tools = [
    ...(memory ? Object.entries(memoryTools(memory)) : []),
    ...(terminals ? Object.entries(terminalTools(terminals, cwd)) : []),
  ].map(([name, tool]) => ({ type: 'function', name, description: tool.description, inputSchema: z.toJSONSchema(z.object(tool.input)) }));

  if (tools.length === 0) return undefined;

  return [{ type: 'namespace', name: JINION_NAMESPACE, description: "Jinion's notes, which carry over to later conversations, and the project's terminals.", tools }];
}

/** Runs one of the tools for Codex; `undefined` for a tool that isn't Jinion's. */
export async function runJinionTool({ memory, terminals, cwd }: JinionTools, name: string, input: unknown) {
  if (memory && MEMORY_TOOLS[name]) {
    const { remember, recall, forget } = memoryTools(memory);

    switch (MEMORY_TOOLS[name]) {
      case 'remember':
        return remember.run(z.object(remember.input).parse(input));
      case 'recall':
        return recall.run(z.object(recall.input).parse(input));
      case 'forget':
        return forget.run(z.object(forget.input).parse(input));
    }
  }

  if (!terminals || !isTerminalTool(name)) return undefined;

  const tools = terminalTools(terminals, cwd);

  switch (name) {
    case 'terminals':
      return tools.terminals.run({});
    case 'read_terminal':
      return tools.read_terminal.run(z.object(tools.read_terminal.input).parse(input));
    case 'run_in_terminal':
      return tools.run_in_terminal.run(z.object(tools.run_in_terminal.input).parse(input));
  }
}

/** Added to Codex's own instructions, which stay as they are, as do the AGENTS.md files it reads itself. */
export function developerInstructions(store?: MemoryStore) {
  const identity = "You work in Jinion, a coding agent in the user's terminal. To the user you are Jinion.";

  return [identity, store && memorySection(store)].filter(Boolean).join('\n\n');
}
