import type { SDKControlGetUsageResponse } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { modelName, toAgentUsage } from './usage.js';

const drivers = (pct: number) => ({
  request_count: 913,
  session_count: 6,
  behaviors: [
    { key: 'long_context' as const, pct: pct / 2, count: 10 },
    { key: 'subagent_heavy' as const, pct, count: 20 },
  ],
  agents: [{ name: 'Explore', pct: 5 }],
  skills: [{ name: 'review', pct: 1 }],
  plugins: [],
  mcp_servers: [{ name: 'context7', pct: 2 }],
});

const response = {
  session: {
    total_cost_usd: 1.42,
    total_api_duration_ms: 252_000,
    total_duration_ms: 2_280_000,
    total_lines_added: 1322,
    total_lines_removed: 209,
    model_usage: {
      'claude-haiku-4-5-20251001': { inputTokens: 10, outputTokens: 20, cacheReadInputTokens: 30, cacheCreationInputTokens: 40, webSearchRequests: 0, costUSD: 0.04, contextWindow: 200_000, maxOutputTokens: 32_000 },
      'claude-opus-5-5': { inputTokens: 1, outputTokens: 2, cacheReadInputTokens: 3, cacheCreationInputTokens: 4, webSearchRequests: 0, costUSD: 1.38, contextWindow: 1_000_000, maxOutputTokens: 128_000 },
    },
  },
  subscription_type: 'team',
  rate_limits_available: true,
  rate_limits: {
    five_hour: { utilization: 43, resets_at: '2026-10-03T13:09:00Z' },
    seven_day: { utilization: 36, resets_at: null },
    seven_day_opus: { utilization: null, resets_at: null },
    model_scoped: [{ display_name: 'Fable', utilization: 0, resets_at: '2026-10-05T10:00:00Z' }],
    extra_usage: { is_enabled: true, monthly_limit: 50, used_credits: 12.4, utilization: 25, currency: 'USD' },
  },
  behaviors: { day: drivers(98), week: drivers(64) },
} as unknown as SDKControlGetUsageResponse;

describe('toAgentUsage', () => {
  it('maps Claude Code’s /usage: the session by model, the plan’s windows and what adds to them', () => {
    const usage = toAgentUsage(response);
    expect(usage.session?.models.map((model) => `${model.name} ${model.cost}`)).toEqual(['Opus 5.5 1.38', 'Haiku 4.5 0.04']);
    expect(usage.limits).toEqual([
      { label: '5-hour window', used: 0.43, resetsAt: Date.parse('2026-10-03T13:09:00Z') },
      { label: 'Week, all models', used: 0.36, resetsAt: undefined },
      { label: 'Week, Fable', used: 0, resetsAt: Date.parse('2026-10-05T10:00:00Z') },
    ]);
    expect(usage.extra).toEqual({ used: 12.4, limit: 50, currency: 'USD' });
    expect(usage.drivers?.day.traits).toEqual([
      { trait: 'subagents', share: 0.98 },
      { trait: 'long-context', share: 0.49 },
    ]);
    expect(usage.drivers?.day.sources.map((source) => `${source.kind} ${source.name}`)).toEqual(['agent Explore', 'mcp context7', 'skill review']);
  });

  it('has no limits for a login without a plan, and no drivers until asked for', () => {
    const usage = toAgentUsage({ ...response, rate_limits: null, behaviors: null });
    expect(usage).toMatchObject({ limits: [], extra: undefined, drivers: undefined });
  });
});

describe('modelName', () => {
  it('reads model ids the way people say them', () => {
    expect(['claude-opus-5-5', 'claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-fable-5-1', 'gpt-5'].map(modelName)).toEqual([
      'Opus 5.5',
      'Haiku 4.5',
      'Sonnet 5',
      'Fable 5.1',
      'gpt-5',
    ]);
  });
});
