import type { AgentCommand } from '@jinion/core/agent/agent';
import type { ModelOption } from '@jinion/core/agent/models';
import type { MemoryNote } from '@jinion/core/api/schemas';

/** Each backend's models, as `AppFields.models` holds them. */
export const models: Record<string, ModelOption[]> = {
  Claude: [
    { id: 'claude-opus-4-6', name: 'Opus 4.6', description: 'The most capable, for hard work', efforts: ['low', 'medium', 'high'] },
    { id: 'claude-sonnet-4-6', name: 'Sonnet 4.6', description: 'Fast and capable, for everyday work', efforts: ['low', 'medium', 'high'] },
    { id: 'claude-haiku-4-5', name: 'Haiku 4.5', description: 'The fastest, for small tasks', efforts: [] },
  ],
  Codex: [
    { id: 'gpt-5.5-codex', name: 'GPT-5.5 Codex', description: 'Tuned for code', efforts: ['low', 'medium', 'high'] },
    { id: 'gpt-5.5', name: 'GPT-5.5', description: 'The general model', efforts: ['low', 'medium', 'high'] },
  ],
};

export const skills: AgentCommand[] = [
  { name: 'review', description: 'Review the changes on this branch for bugs and style', source: 'skill', group: 'Project' },
  { name: 'release-notes', description: 'Write release notes from the commits since the last tag', source: 'skill', group: 'Project' },
  { name: 'db-migration', description: 'Write a migration for a schema change, with its rollback', source: 'skill', group: 'Project', argumentHint: '<change>' },
  { name: 'explain-like-pr', description: 'Explain a change the way a pull request description would', source: 'skill', group: 'Personal' },
  { name: 'tidy-imports', description: 'Sort and group imports in the files you name', source: 'skill', group: 'Personal', argumentHint: '[files]' },
  { name: 'linear:create-issue', description: 'Open a Linear issue from what we just talked about', source: 'mcp', group: 'linear' },
  { name: 'linear:my-issues', description: 'List the issues assigned to you', source: 'mcp', group: 'linear' },
  { name: 'sentry:recent-errors', description: 'Show the newest errors in production', source: 'mcp', group: 'sentry' },
];

const day = (count: number) => new Date(Date.now() - count * 86_400_000).toISOString().slice(0, 10);

export const memory: MemoryNote[] = [
  {
    scope: 'project',
    id: 'use-pnpm',
    title: 'Use pnpm',
    description: 'The repo uses pnpm workspaces; never npm or yarn',
    type: 'preference',
    updated: day(12),
    content: 'Install and run scripts with pnpm. The lockfile is pnpm-lock.yaml, and CI fails on any other.',
    path: '.jinion/memory/use-pnpm.md',
  },
  {
    scope: 'project',
    id: 'single-instance',
    title: 'The API runs as one instance',
    description: 'No shared store yet, so in-memory state is fine for now',
    type: 'fact',
    updated: day(3),
    content: 'Production runs a single container. Redis comes when a second instance does; until then a Map is fine for caches and counters.',
    path: '.jinion/memory/single-instance.md',
  },
  {
    scope: 'project',
    id: 'errors-through-http-error',
    title: 'Errors go through HttpError',
    description: 'Throw HttpError subclasses; the error handler turns them into responses',
    type: 'decision',
    updated: day(20),
    content: 'Routes throw an `HttpError` (src/http/errors.ts) rather than writing error responses themselves, so every error has the same shape.',
    path: '.jinion/memory/errors-through-http-error.md',
  },
  {
    scope: 'user',
    id: 'short-commits',
    title: 'One-line commits',
    description: 'Commit messages are a single Conventional Commits line',
    type: 'preference',
    updated: day(40),
    content: 'Write commits as one line, such as `fix(api): keep the session on refresh`, with no body.',
    path: '~/.jinion/memory/short-commits.md',
  },
  {
    scope: 'user',
    id: 'explain-in-turkish',
    title: 'Explanations in Turkish',
    description: 'Answer in Turkish when asked in Turkish; code and commits stay English',
    type: 'preference',
    updated: day(7),
    content: 'Reply in the language of the question. Code, comments and commit messages stay in English.',
    path: '~/.jinion/memory/explain-in-turkish.md',
  },
];
