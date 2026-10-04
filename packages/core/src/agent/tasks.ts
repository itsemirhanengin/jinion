import { z } from 'zod';

export const BackgroundTask = z.object({
  id: z.string(),
  kind: z.enum(['shell', 'agent', 'other']),
  title: z.string(),
  status: z.enum(['running', 'completed', 'failed', 'stopped']),
  startedAt: z.number(),
  endedAt: z.number().optional(),
  output: z.string().optional(),
  calls: z.number().optional(),
  lastCall: z.string().optional(),
  /** The turn waits for it. The backend lists a long command here after a few seconds. */
  foreground: z.boolean().optional(),
});

export type BackgroundTask = z.infer<typeof BackgroundTask>;
