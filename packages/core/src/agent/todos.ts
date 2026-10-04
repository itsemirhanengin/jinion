import { z } from 'zod';

export const TodoStatus = z.enum(['pending', 'active', 'done']);

export type TodoStatus = z.infer<typeof TodoStatus>;

export const TodoItem = z.object({ text: z.string(), status: TodoStatus });

export type TodoItem = z.infer<typeof TodoItem>;

export const TodoGroup = z.object({ title: z.string(), items: z.array(TodoItem) });

export type TodoGroup = z.infer<typeof TodoGroup>;
