import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import type { MemoryStore } from '../../memory/store.js';
import { memoryTools } from '../../memory/tools.js';

export const MEMORY_SERVER = 'jinion';

export const isMemoryTool = (name: string) => name.startsWith(`mcp__${MEMORY_SERVER}__`);

export function memoryServer(store: MemoryStore) {
  const { remember, recall, forget } = memoryTools(store);

  return createSdkMcpServer({
    name: MEMORY_SERVER,
    version: '0.1.0',
    // The prompt counts on these tools, so they are never deferred behind ToolSearch like other MCP tools.
    alwaysLoad: true,
    tools: [
      tool('remember', remember.description, remember.input, async (note) => text(remember.run(note))),
      tool('recall', recall.description, recall.input, async (input) => text(recall.run(input))),
      tool('forget', forget.description, forget.input, async (input) => text(forget.run(input))),
    ],
  });
}

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });
