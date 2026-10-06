import { z } from 'zod';

export const TerminalInfo = z.object({
  id: z.string(),
  /** The shell's name, or the command the agent ran. */
  title: z.string(),
  cwd: z.string(),
  /** Started by the agent, and kept once its command ends so its output can still be read. */
  agent: z.boolean(),
  running: z.boolean(),
  exitCode: z.number().optional(),
  startedAt: z.number(),
});

export type TerminalInfo = z.infer<typeof TerminalInfo>;

/** What a terminal wrote, numbered in its own order, so a client that just read the screen skips what it already has. */
export const TerminalOutput = z.object({ id: z.string(), seq: z.number(), data: z.string() });

export type TerminalOutput = z.infer<typeof TerminalOutput>;
