import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { MEMORY_SCOPES, MEMORY_TYPES, type Memory, type MemoryStore } from '../../memory/store.js';

/** The MCP server's name; its tools reach Claude as `mcp__jinion__<tool>`. */
export const MEMORY_SERVER = 'jinion';

export const isMemoryTool = (name: string) => name.startsWith(`mcp__${MEMORY_SERVER}__`);

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] });

const show = (memory: Memory) =>
  [`# ${memory.scope}/${memory.id}: ${memory.title}`, `${memory.type}, updated ${memory.updated}`, '', memory.content].join('\n');

/** Jinion's memory as tools, served from inside the Jinion process. */
export function memoryServer(store: MemoryStore) {
  return createSdkMcpServer({
    name: MEMORY_SERVER,
    version: '0.1.0',
    // The prompt counts on these tools, so they are never deferred behind ToolSearch like other MCP tools.
    alwaysLoad: true,
    tools: [
      tool(
        'remember',
        'Saves a note for later conversations, or updates the note with `id`.',
        {
          scope: z.enum(MEMORY_SCOPES).describe('user: about the user, in every project. project: this project only.'),
          title: z.string().describe('A few words.'),
          description: z.string().describe('One line, shown in the index of every later conversation.'),
          type: z.enum(MEMORY_TYPES),
          content: z.string().describe('The fact, with the reason behind it when there is one.'),
          id: z.string().optional().describe('The id of a note in the same scope to update instead of adding one.'),
        },
        async (note) => {
          const memory = store.save(note);
          return text(`Saved ${memory.scope}/${memory.id}.`);
        },
      ),
      tool(
        'recall',
        'Reads notes in full. Without ids, lists every note.',
        { ids: z.array(z.string()).optional().describe('As scope/id, e.g. project/use-pnpm.') },
        async ({ ids }) => {
          if (!ids || ids.length === 0) {
            const all = store.list();
            return text(all.length ? all.map((memory) => `${memory.scope}/${memory.id}: ${memory.description}`).join('\n') : 'No notes yet.');
          }
          return text(ids.map((id) => {
            const memory = store.find(id);
            return memory ? show(memory) : `# ${id}\nNo such note.`;
          }).join('\n\n'));
        },
      ),
      tool('forget', 'Deletes a note that turned out wrong or no longer holds.', { id: z.string().describe('As scope/id.') }, async ({ id }) =>
        text(store.remove(id) ? `Forgot ${id}.` : `There is no note ${id}.`),
      ),
    ],
  });
}
