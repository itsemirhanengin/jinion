import { z } from 'zod';
import { memorySection } from '../../memory/prompt.js';
import type { MemoryStore } from '../../memory/store.js';
import { type MemoryAction, memoryTools } from '../../memory/tools.js';

/** Jinion's notes come as tools of their own, apart from Codex's memories. */
export const MEMORY_NAMESPACE = 'jinion';

export const MEMORY_TOOLS: Record<string, MemoryAction> = { remember: 'remember', recall: 'recall', forget: 'forget' };

/** The tools as Codex takes them when a conversation starts. */
export function memoryToolSpecs(store: MemoryStore) {
  const tools = Object.entries(memoryTools(store)).map(([name, tool]) => ({
    type: 'function',
    name,
    description: tool.description,
    inputSchema: z.toJSONSchema(z.object(tool.input)),
  }));

  return [{ type: 'namespace', name: MEMORY_NAMESPACE, description: "Jinion's notes, which carry over to later conversations.", tools }];
}

/** Runs one of the tools for Codex; `undefined` for a tool that isn't Jinion's. */
export function runMemoryTool(store: MemoryStore, name: string, input: unknown) {
  const { remember, recall, forget } = memoryTools(store);

  switch (MEMORY_TOOLS[name]) {
    case 'remember':
      return remember.run(z.object(remember.input).parse(input));
    case 'recall':
      return recall.run(z.object(recall.input).parse(input));
    case 'forget':
      return forget.run(z.object(forget.input).parse(input));
    default:
      return undefined;
  }
}

/** Added to Codex's own instructions, which stay as they are, as do the AGENTS.md files it reads itself. */
export function developerInstructions(store?: MemoryStore) {
  const identity = "You work in Jinion, a coding agent in the user's terminal. To the user you are Jinion.";

  return [identity, store && memorySection(store)].filter(Boolean).join('\n\n');
}
