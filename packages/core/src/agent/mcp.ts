import { z } from 'zod';

export interface AgentMcp {
  servers(): Promise<McpServerInfo[]>;
  /** From the next turn on; the conversation carries on. */
  setEnabled(changes: Record<string, boolean>): Promise<void>;
}

export const McpServerInfo = z.object({
  name: z.string(),
  label: z.string(),
  source: z.string(),
  enabled: z.boolean(),
  status: z.enum(['connected', 'pending', 'needs-auth', 'failed', 'off']),
  target: z.string().optional(),
  error: z.string().optional(),
  tools: z.array(z.string()),
});

export type McpServerInfo = z.infer<typeof McpServerInfo>;
