import { z } from 'zod';

/** A local address a terminal printed, which answers now. */
export const DevServer = z.object({ url: z.string(), terminal: z.string(), title: z.string() });

export type DevServer = z.infer<typeof DevServer>;

/** A script of the project's `package.json` that starts a server, and the command that runs it with its package manager. */
export const DevScript = z.object({ name: z.string(), script: z.string(), command: z.string() });

export type DevScript = z.infer<typeof DevScript>;
