import { z } from 'zod';

export const PermissionRequest = z.object({
  title: z.string(),
  command: z.string().optional(),
  subject: z.string().optional(),
  description: z.string().optional(),
  /** What a yes for good covers, and where, e.g. `` `pnpm add:*` in this project ``. */
  always: z.string().optional(),
  defaultToNo: z.boolean().optional(),
});

export type PermissionRequest = z.infer<typeof PermissionRequest>;

export const PermissionDecision = z.union([
  z.object({ allow: z.literal(true), always: z.boolean().optional() }),
  z.object({ allow: z.literal(false), note: z.string().optional() }),
]);

export type PermissionDecision = z.infer<typeof PermissionDecision>;
