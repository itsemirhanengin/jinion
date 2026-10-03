import type { ContextUsage, Usage } from '../usage.js';

const SYSTEM = [
  { name: 'System prompt', tokens: 2_100 },
  { name: 'System tools', tokens: 8_300 },
  { name: 'Skills', tokens: 2_000 },
];
const SYSTEM_TOKENS = SYSTEM.reduce((sum, { tokens }) => sum + tokens, 0);

export function demoContext({ contextTokens: used, contextWindow: window, compactAt }: Usage): ContextUsage {
  const messages = Math.max(0, used - SYSTEM_TOKENS);
  const limit = compactAt ?? window;
  return {
    used: Math.max(used, SYSTEM_TOKENS),
    window,
    compactAt,
    categories: [
      ...SYSTEM.map((category) => ({ ...category, kind: 'used' as const })),
      { name: 'Messages', tokens: messages, kind: 'used' },
      { name: 'MCP tools (deferred)', tokens: 31_200, kind: 'deferred' },
      { name: 'Free space', tokens: limit - SYSTEM_TOKENS - messages, kind: 'free' },
      { name: 'Autocompact buffer', tokens: window - limit, kind: 'buffer' },
    ],
  };
}

export function demoSummary(focus = 'the open work and the decisions behind it') {
  return [
    '1. Primary request: add rate limiting to the public API.',
    `2. Kept in focus: ${focus}.`,
    '3. Files: src/middleware/rate-limit.ts, src/server.ts.',
  ].join('\n');
}
