import { z } from 'zod';

export const MemoryScope = z.enum(['user', 'project']);

export type MemoryScope = z.infer<typeof MemoryScope>;

export const MemoryType = z.enum(['preference', 'decision', 'fact', 'reference']);

export type MemoryType = z.infer<typeof MemoryType>;

export const Memory = z.object({
  scope: MemoryScope,
  id: z.string(),
  title: z.string(),
  description: z.string(),
  type: MemoryType,
  updated: z.string(),
  content: z.string(),
});

export type Memory = z.infer<typeof Memory>;

export type NewMemory = Omit<Memory, 'id' | 'updated'> & { id?: string };
