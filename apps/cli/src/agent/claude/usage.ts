import type { query, SDKControlGetUsageResponse, SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { AgentUsage, ContextUsage, LimitWindow, UsageDrivers } from '../usage.js';

type Query = ReturnType<typeof query>;
type Window = { utilization: number | null; resets_at: string | null } | null | undefined;
type Behaviors = NonNullable<SDKControlGetUsageResponse['behaviors']>['day'];
type RateLimitInfo = Extract<SDKMessage, { type: 'rate_limit_event' }>['rate_limit_info'];

const WINDOWS = {
  five_hour: { short: '5h', long: '5-hour window' },
  seven_day: { short: '7d', long: 'Week, all models' },
  seven_day_opus: { short: '7d opus', long: 'Week, Opus' },
  seven_day_sonnet: { short: '7d sonnet', long: 'Week, Sonnet' },
} as const;

type WindowId = keyof typeof WINDOWS;

const WINDOW_IDS = Object.keys(WINDOWS) as WindowId[];

/** Its SDK call is marked experimental, so it is reached for in this one place only. */
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
          ...WINDOW_IDS.map((id) => window(WINDOWS[id].long, limits[id])),
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

/** `unifiedWindows` isn't in the SDK types yet. Unlike `/usage`, use is a fraction or percent and resets are in seconds. */
export function limitWindows(info: RateLimitInfo): LimitWindow[] {
  const unified = (info as { unifiedWindows?: Record<string, { utilization?: number; resetsAt?: number }> })
    .unifiedWindows;
  const entries = unified
    ? Object.entries(unified)
    : info.rateLimitType
      ? [[info.rateLimitType, { utilization: info.utilization, resetsAt: info.resetsAt }] as const]
      : [];
  return entries.flatMap(([id, window]) =>
    typeof window.utilization === 'number'
      ? [
          {
            label: Object.hasOwn(WINDOWS, id) ? WINDOWS[id as WindowId].short : id,
            used: window.utilization > 1 ? window.utilization / 100 : window.utilization,
            resetsAt: window.resetsAt === undefined ? undefined : window.resetsAt * 1000,
          },
        ]
      : [],
  );
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

type ContextResponse = Awaited<ReturnType<Query['getContextUsage']>>;

export function toContextUsage(response: ContextResponse): ContextUsage {
  return {
    used: response.totalTokens,
    window: response.rawMaxTokens,
    compactAt: response.isAutoCompactEnabled ? response.autoCompactThreshold : undefined,
    categories: response.categories.map(({ name, tokens, kind }) => ({ name, tokens, kind })),
  };
}

export function modelName(id: string) {
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?$/.exec(id);
  if (!match) return id;
  const [, family, major, minor] = match;
  return `${family!.charAt(0).toUpperCase()}${family!.slice(1)} ${major}${minor ? `.${minor}` : ''}`;
}
