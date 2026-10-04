import { z } from 'zod';
import type { MemoryStore } from './store.js';
import { type Memory, MemoryScope, MemoryType } from './types.js';

/** A tool the agent keeps its notes with; each backend offers it its own way. */
export interface MemoryTool<S extends z.ZodRawShape = z.ZodRawShape> {
  description: string;
  input: S;
  run(input: z.infer<z.ZodObject<S>>): string;
}

const define = <S extends z.ZodRawShape>(tool: MemoryTool<S>) => tool;

export function memoryTools(store: MemoryStore) {
  return {
    remember: define({
      description: 'Saves a note for later conversations, or updates the note with `id`.',
      input: {
        scope: MemoryScope.describe('user: about the user, in every project. project: this project only.'),
        title: z.string().describe('A few words.'),
        description: z.string().describe('One line, shown in the index of every later conversation.'),
        type: MemoryType,
        content: z.string().describe('The fact, with the reason behind it when there is one.'),
        id: z.string().optional().describe('The id of a note in the same scope to update instead of adding one.'),
      },
      run: (note) => {
        const memory = store.save(note);

        return `Saved ${memory.scope}/${memory.id}.`;
      },
    }),
    recall: define({
      description: 'Reads notes in full. Without ids, lists every note.',
      input: { ids: z.array(z.string()).optional().describe('As scope/id, e.g. project/use-pnpm.') },
      run: ({ ids }) => {
        if (!ids || ids.length === 0) {
          const all = store.list();

          return all.length ? all.map((memory) => `${memory.scope}/${memory.id}: ${memory.description}`).join('\n') : 'No notes yet.';
        }

        return ids
          .map((id) => {
            const memory = store.find(id);

            return memory ? show(memory) : `# ${id}\nNo such note.`;
          })
          .join('\n\n');
      },
    }),
    forget: define({
      description: 'Deletes a note that turned out wrong or no longer holds.',
      input: { id: z.string().describe('As scope/id.') },
      run: ({ id }) => (store.remove(id) ? `Forgot ${id}.` : `There is no note ${id}.`),
    }),
  };
}

export type MemoryTools = ReturnType<typeof memoryTools>;

export type MemoryAction = keyof MemoryTools;

const show = (memory: Memory) =>
  [`# ${memory.scope}/${memory.id}: ${memory.title}`, `${memory.type}, updated ${memory.updated}`, '', memory.content].join('\n');
