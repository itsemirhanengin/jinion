import { basename } from 'node:path';
import type { ReactNode } from 'react';
import { countChanges, Meter, parsePatch, Tag, Text, type Theme } from '@jinion/tui';
import type { AgentMode, LimitWindow } from '../agent/types.js';
import type { AppInfo, ModelState } from '../context.js';
import { modeColor, MODES } from '../modes.js';
import { tildify } from '../paths.js';
import type { Entry, Session } from '../session.js';
import type { GitStatus } from './git.js';

/** Everything a segment can show. */
export interface StatusData {
  info: AppInfo;
  model: ModelState;
  mode: AgentMode;
  session: Session;
  git?: GitStatus;
  limits?: LimitWindow[];
  now: number;
  theme: Theme;
}

export interface SegmentStyle {
  id: string;
  name: string;
}

export interface Segment {
  id: string;
  name: string;
  description: string;
  /** Ways to show it; the first is the default. */
  styles?: SegmentStyle[];
  /** Changes with the clock, so the line redraws now and then. */
  ticks?: boolean;
  /** Needs `git status`. */
  git?: boolean;
  /** `undefined` while there is nothing to show, e.g. limits before the first request. */
  render(data: StatusData, style: string): ReactNode | undefined;
}

/** Every item the status line can show, in the order `/statusline` lists them. */
export const SEGMENTS: Segment[] = [
  {
    id: 'brand',
    name: 'Jinion',
    description: 'The app name',
    render: ({ theme }) => <Text color={theme.muted}>jinion</Text>,
  },
  {
    id: 'model',
    name: 'Model',
    description: 'The model in use',
    styles: [
      { id: 'effort', name: 'with effort' },
      { id: 'name', name: 'name only' },
    ],
    render: ({ model, theme }, style) => {
      const effort = style === 'effort' && model.selection.effort;
      return <Tag name="M" value={effort ? `${model.name} · ${effort}` : model.name} color={theme.status.model} />;
    },
  },
  {
    id: 'mode',
    name: 'Mode',
    description: 'How freely the agent acts; it also shows under the prompt',
    render: ({ mode, theme }) => <Text color={modeColor(theme, mode)}>{MODES[mode].name}</Text>,
  },
  {
    id: 'directory',
    name: 'Directory',
    description: 'Where jinion is working',
    styles: [
      { id: 'short', name: 'last two folders' },
      { id: 'full', name: 'full path' },
      { id: 'folder', name: 'folder name' },
    ],
    render: ({ info, theme }, style) => {
      const path = tildify(info.cwd);
      const value =
        style === 'full' ? path : style === 'folder' ? basename(info.cwd) : path.split('/').filter(Boolean).slice(-2).join('/');
      return <Tag name="D" value={value} color={theme.status.directory} />;
    },
  },
  {
    id: 'git',
    name: 'Git',
    description: 'The branch, with uncommitted files and commits ahead or behind',
    styles: [
      { id: 'changes', name: 'with changes' },
      { id: 'branch', name: 'branch only' },
    ],
    git: true,
    render: ({ git, theme }, style) => {
      if (!git) return undefined;
      const details =
        style === 'changes'
          ? [git.changed > 0 && `*${git.changed}`, git.ahead > 0 && `↑${git.ahead}`, git.behind > 0 && `↓${git.behind}`]
          : [];
      const extra = details.filter(Boolean).join(' ');
      return (
        <Tag
          name="G"
          value={
            <Text>
              {git.branch}
              {extra && <Text color={theme.warning}> {extra}</Text>}
            </Text>
          }
          color={theme.code}
        />
      );
    },
  },
  {
    id: 'context',
    name: 'Context',
    description: 'How full the context window is',
    styles: [
      { id: 'tokens', name: 'tokens' },
      { id: 'percent', name: 'percent' },
      { id: 'bar', name: 'meter' },
    ],
    render: ({ session, theme }, style) => {
      const { contextTokens, contextWindow } = session.usage;
      const used = contextWindow > 0 ? contextTokens / contextWindow : 0;
      if (style === 'tokens') return <Text>ctx: {formatTokens(contextTokens)}/{formatTokens(contextWindow)}</Text>;
      const percent = <Text color={levelColor(theme, used)}>{Math.round(used * 100)}%</Text>;
      if (style === 'percent') return <Text>ctx {percent}</Text>;
      return (
        <Text>
          ctx <Meter value={used} /> {percent}
        </Text>
      );
    },
  },
  {
    id: 'limits',
    name: 'Plan limits',
    description: 'How much of your plan is used, per window; shows after the first request',
    styles: [
      { id: 'both', name: '5h and 7d' },
      { id: 'session', name: '5h with reset time' },
      { id: 'week', name: '7d' },
      { id: 'bar', name: '5h meter' },
    ],
    ticks: true,
    render: ({ limits, now, theme }, style) => {
      const five = limits?.find((window) => window.label === '5h');
      const week = limits?.find((window) => window.label === '7d');
      const usage = (window: LimitWindow) => (
        <Text>
          {window.label} <Text color={levelColor(theme, window.used)}>{Math.round(window.used * 100)}%</Text>
        </Text>
      );
      if (style === 'week') return week && usage(week);
      if (!five) return undefined;
      if (style === 'bar') {
        return (
          <Text>
            5h <Meter value={five.used} /> <Text color={levelColor(theme, five.used)}>{Math.round(five.used * 100)}%</Text>
          </Text>
        );
      }
      if (style === 'session') {
        return (
          <Text>
            {usage(five)}
            {five.resetsAt !== undefined && five.resetsAt > now && (
              <Text color={theme.muted}> · resets in {formatDuration(five.resetsAt - now)}</Text>
            )}
          </Text>
        );
      }
      return (
        <Text>
          {usage(five)}
          {week && (
            <>
              <Text color={theme.muted}> · </Text>
              {usage(week)}
            </>
          )}
        </Text>
      );
    },
  },
  {
    id: 'cost',
    name: 'Cost',
    description: "What the conversation would cost at API prices; a subscription doesn't bill it",
    render: ({ session, theme }) => <Text color={theme.status.cost}>${session.usage.cost.toFixed(2)}</Text>,
  },
  {
    id: 'changes',
    name: 'Changes',
    description: 'Lines added and removed in this conversation',
    render: ({ session, theme }) => {
      const { added, removed } = sessionChanges(session.entries);
      if (added === 0 && removed === 0) return undefined;
      return (
        <Text>
          <Text color={theme.success}>+{added}</Text> <Text color={theme.error}>-{removed}</Text>
        </Text>
      );
    },
  },
  {
    id: 'tasks',
    name: 'Tasks',
    description: "Progress on the agent's task list",
    render: ({ session, theme }) => {
      const items = session.todos.flatMap((group) => group.items);
      if (items.length === 0) return undefined;
      const done = items.filter((item) => item.status === 'done').length;
      return (
        <Text>
          <Text color={theme.muted}>tasks </Text>
          {done}/{items.length}
        </Text>
      );
    },
  },
  {
    id: 'title',
    name: 'Title',
    description: 'What the conversation is about',
    render: ({ session, theme }) => session.title && <Text color={theme.muted}>{session.title}</Text>,
  },
  {
    id: 'duration',
    name: 'Duration',
    description: 'How long ago the conversation started',
    ticks: true,
    render: ({ session, now, theme }) => <Text color={theme.muted}>{formatDuration(now - session.createdAt)}</Text>,
  },
  {
    id: 'turns',
    name: 'Turns',
    description: 'Prompts sent in this conversation',
    render: ({ session, theme }) => {
      const turns = session.entries.filter((entry) => entry.kind === 'user').length;
      return <Text color={theme.muted}>{turns === 1 ? '1 turn' : `${turns} turns`}</Text>;
    },
  },
  {
    id: 'time',
    name: 'Clock',
    description: 'The time of day',
    ticks: true,
    render: ({ now, theme }) => (
      <Text color={theme.muted}>{new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
    ),
  },
  {
    id: 'agent',
    name: 'Agent',
    description: 'The backend jinion drives',
    render: ({ model, theme }) => <Text color={theme.muted}>{model.agent}</Text>,
  },
  {
    id: 'version',
    name: 'Version',
    description: "jinion's version",
    render: ({ info, theme }) => <Text color={theme.muted}>v{info.version}</Text>,
  },
];

export const findSegment = (id: string) => SEGMENTS.find((segment) => segment.id === id);

const changesByEntry = new WeakMap<Entry, { added: number; removed: number }>();

/** Entries never change once they are done, so each patch is parsed once. */
export function sessionChanges(entries: Entry[]) {
  let added = 0;
  let removed = 0;
  for (const entry of entries) {
    if (entry.kind !== 'tool' || entry.run.name !== 'edit' || entry.status !== 'done') continue;
    let counts = changesByEntry.get(entry);
    if (!counts) {
      counts = countChanges(parsePatch(entry.run.result?.patch ?? entry.run.input.patch));
      changesByEntry.set(entry, counts);
    }
    added += counts.added;
    removed += counts.removed;
  }
  return { added, removed };
}

const levelColor = (theme: Theme, used: number) =>
  used >= 0.8 ? theme.error : used >= 0.5 ? theme.warning : theme.success;

export function formatTokens(count: number) {
  return count >= 1000 ? `${Math.round(count / 1000)}K` : String(count);
}

function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
