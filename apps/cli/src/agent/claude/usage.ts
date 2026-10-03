import type { query, SDKControlGetUsageResponse } from '@anthropic-ai/claude-agent-sdk';
import type { AgentUsage, LimitWindow, UsageDrivers } from '../types.js';

type Query = ReturnType<typeof query>;
type Window = { utilization: number | null; resets_at: string | null } | null | undefined;
type Behaviors = NonNullable<SDKControlGetUsageResponse['behaviors']>['day'];

/**
 * Claude Code's `/usage` data. Its SDK call is marked experimental, so it is reached for in this one place and mapped
 * to Jinion's own shape; a change to it changes this file only.
 */
export async function claudeUsage(running: Query, drivers: boolean): Promise<AgentUsage> {
  return toAgentUsage(await running.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: !drivers }));
}

export function toAgentUsage(response: SDKControlGetUsageResponse): AgentUsage {
  const { session, rate_limits: limits, behaviors } = response;
  const extra = limits?.extra_usage;
  return {
    session: {
      cost: session.total_cost_usd,
      apiMs: session.total_api_duration_ms,
      wallMs: session.total_duration_ms,
      linesAdded: session.total_lines_added,
      linesRemoved: session.total_lines_removed,
      models: Object.entries(session.model_usage)
        .map(([id, usage]) => ({
          name: modelName(id),
          input: usage.inputTokens,
          output: usage.outputTokens,
          cacheRead: usage.cacheReadInputTokens,
          cacheWrite: usage.cacheCreationInputTokens,
          cost: usage.costUSD,
        }))
        .sort((a, b) => b.cost - a.cost),
    },
    limits: limits
      ? [
          window('5-hour window', limits.five_hour),
          window('Week, all models', limits.seven_day),
          window('Week, Opus', limits.seven_day_opus),
          window('Week, Sonnet', limits.seven_day_sonnet),
          ...(limits.model_scoped ?? []).map((scoped) => window(`Week, ${scoped.display_name}`, scoped)),
        ].filter((item) => item !== undefined)
      : [],
    extra: extra?.is_enabled
      ? { used: extra.used_credits ?? 0, limit: extra.monthly_limit ?? undefined, currency: extra.currency ?? undefined }
      : undefined,
    drivers: behaviors ? { day: toDrivers(behaviors.day), week: toDrivers(behaviors.week) } : undefined,
  };
}

function window(label: string, value: Window): LimitWindow | undefined {
  if (!value || value.utilization === null) return undefined;
  return { label, used: value.utilization / 100, resetsAt: value.resets_at ? Date.parse(value.resets_at) : undefined };
}

const TRAITS: Record<Behaviors['behaviors'][number]['key'], UsageDrivers['traits'][number]['trait']> = {
  cache_miss: 'cache-misses',
  long_context: 'long-context',
  subagent_heavy: 'subagents',
  high_parallel: 'parallel',
  cron: 'scheduled',
};

function toDrivers(window: Behaviors): UsageDrivers {
  const sources = (kind: UsageDrivers['sources'][number]['kind'], items: { name: string; pct: number }[]) =>
    items.map((item) => ({ kind, name: item.name, share: item.pct / 100 }));
  return {
    requests: window.request_count,
    sessions: window.session_count,
    traits: window.behaviors.map((item) => ({ trait: TRAITS[item.key], share: item.pct / 100 })).sort((a, b) => b.share - a.share),
    sources: [
      ...sources('skill', window.skills),
      ...sources('agent', window.agents),
      ...sources('plugin', window.plugins),
      ...sources('mcp', window.mcp_servers),
    ].sort((a, b) => b.share - a.share),
  };
}

/** `claude-opus-5-5` reads as `Opus 5.5`, `claude-haiku-4-5-20251001` as `Haiku 4.5`; anything else as it is. */
export function modelName(id: string) {
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/.exec(id);
  if (!match) return id;
  const [, family, major, minor] = match;
  return `${family!.charAt(0).toUpperCase()}${family!.slice(1)} ${major}${minor ? `.${minor}` : ''}`;
}
