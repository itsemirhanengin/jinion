export interface Usage {
  contextTokens: number;
  contextWindow: number;
  cost: number;
  compactAt?: number;
}

export interface ContextUsage {
  used: number;
  /** Can be smaller than the model's, e.g. a compaction policy's. */
  window: number;
  compactAt?: number;
  /** `buffer` is what compaction keeps in reserve; `deferred` only loads when used, e.g. MCP tools, and takes no room. */
  categories: { name: string; tokens: number; kind: 'used' | 'free' | 'buffer' | 'deferred' }[];
}

export interface ModelTokens {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** Known only as a total, e.g. from a summary of days whose records are gone. */
  summarized?: number;
}

export interface AgentUsage {
  session?: {
    cost: number;
    apiMs: number;
    wallMs: number;
    linesAdded: number;
    linesRemoved: number;
    models: (ModelTokens & { name: string; cost: number })[];
  };
  limits: LimitWindow[];
  extra?: { used: number; limit?: number; currency?: string };
  drivers?: { day: UsageDrivers; week: UsageDrivers };
}

export interface UsageDrivers {
  requests: number;
  sessions: number;
  /** They overlap: each share is of the whole, so they don't add up to 100. */
  traits: { trait: 'cache-misses' | 'long-context' | 'subagents' | 'parallel' | 'scheduled'; share: number }[];
  sources: { kind: 'skill' | 'agent' | 'plugin' | 'mcp'; name: string; share: number }[];
}

export interface UsageHistory {
  days: DayUsage[];
  sessions: { id: string; start: number; end: number }[];
}

export interface DayUsage {
  date: string;
  messages: number;
  sessions: number;
  toolCalls: number;
  models: Record<string, ModelTokens>;
}

export interface LimitWindow {
  label: string;
  /** From 0 to 1. */
  used: number;
  resetsAt?: number;
}

export const emptyTokens = (): ModelTokens => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
