export interface AgentMcp {
  servers(): Promise<McpServerInfo[]>;
  /** From the next turn on; the conversation carries on. */
  setEnabled(changes: Record<string, boolean>): Promise<void>;
}

export interface McpServerInfo {
  name: string;
  label: string;
  source: string;
  enabled: boolean;
  status: 'connected' | 'pending' | 'needs-auth' | 'failed' | 'off';
  target?: string;
  error?: string;
  tools: string[];
}
