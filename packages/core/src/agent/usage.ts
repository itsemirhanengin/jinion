import { z } from 'zod';

export const Usage = z.object({
  contextTokens: z.number(),
  contextWindow: z.number(),
  cost: z.number(),
  compactAt: z.number().optional(),
});

export type Usage = z.infer<typeof Usage>;

export const ContextUsage = z.object({
  used: z.number(),
  /** Can be smaller than the model's, e.g. a compaction policy's. */
  window: z.number(),
  compactAt: z.number().optional(),
  /** `buffer` is what compaction keeps in reserve; `deferred` only loads when used, e.g. MCP tools, and takes no room. */
  categories: z.array(z.object({ name: z.string(), tokens: z.number(), kind: z.enum(['used', 'free', 'buffer', 'deferred']) })),
});

export type ContextUsage = z.infer<typeof ContextUsage>;

export const ModelTokens = z.object({
  input: z.number(),
  output: z.number(),
  cacheRead: z.number(),
  cacheWrite: z.number(),
  /** Known only as a total, e.g. from a summary of days whose records are gone. */
  summarized: z.number().optional(),
});

export type ModelTokens = z.infer<typeof ModelTokens>;

export const LimitWindow = z.object({
  label: z.string(),
  /** From 0 to 1. */
  used: z.number(),
  resetsAt: z.number().optional(),
});

export type LimitWindow = z.infer<typeof LimitWindow>;

export const UsageDrivers = z.object({
  requests: z.number(),
  sessions: z.number(),
  /** They overlap: each share is of the whole, so they don't add up to 100. */
  traits: z.array(z.object({ trait: z.enum(['cache-misses', 'long-context', 'subagents', 'parallel', 'scheduled']), share: z.number() })),
  sources: z.array(z.object({ kind: z.enum(['skill', 'agent', 'plugin', 'mcp']), name: z.string(), share: z.number() })),
});

export type UsageDrivers = z.infer<typeof UsageDrivers>;

export const AgentUsage = z.object({
  session: z
    .object({
      cost: z.number(),
      apiMs: z.number(),
      wallMs: z.number(),
      linesAdded: z.number(),
      linesRemoved: z.number(),
      models: z.array(ModelTokens.extend({ name: z.string(), cost: z.number() })),
    })
    .optional(),
  limits: z.array(LimitWindow),
  extra: z.object({ used: z.number(), limit: z.number().optional(), currency: z.string().optional() }).optional(),
  drivers: z.object({ day: UsageDrivers, week: UsageDrivers }).optional(),
});

export type AgentUsage = z.infer<typeof AgentUsage>;

export const DayUsage = z.object({
  date: z.string(),
  messages: z.number(),
  sessions: z.number(),
  toolCalls: z.number(),
  models: z.record(z.string(), ModelTokens),
});

export type DayUsage = z.infer<typeof DayUsage>;

export const UsageHistory = z.object({
  days: z.array(DayUsage),
  sessions: z.array(z.object({ id: z.string(), start: z.number(), end: z.number() })),
});

export type UsageHistory = z.infer<typeof UsageHistory>;

/** Every backend's history together, as a profile shows it: the totals, each day's tokens and the models used. */
export const UsageProfile = z.object({
  days: z.array(z.object({ date: z.string(), tokens: z.number(), messages: z.number() })),
  tokens: z.number(),
  /** The day with the most tokens. */
  peak: z.object({ date: z.string(), tokens: z.number() }).optional(),
  currentStreak: z.number(),
  longestStreak: z.number(),
  sessions: z.number(),
  messages: z.number(),
  toolCalls: z.number(),
  activeDays: z.number(),
  /** The day with the most messages. */
  mostActive: z.object({ date: z.string(), messages: z.number() }).optional(),
  models: z.array(z.object({ name: z.string(), tokens: z.number(), share: z.number() })),
});

export type UsageProfile = z.infer<typeof UsageProfile>;

export const SeenLimit = z.object({ windows: z.array(LimitWindow), at: z.number() });

export type SeenLimit = z.infer<typeof SeenLimit>;

/** Kept per account, so `/account` can show how full the plans not in use were when last seen. */
export const SeenLimits = z.record(z.string(), SeenLimit);

export type SeenLimits = z.infer<typeof SeenLimits>;

export const limitsKey = (agent: string, account = 'default') => `${agent}/${account}`;

export const emptyTokens = (): ModelTokens => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
