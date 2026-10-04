import { addPatch, deletePatch } from '../patches.js';
import type { GrepMatch, SearchHit, ToolCall, ToolResult } from '../tools.js';
import type { FileUpdateChange, ThreadItem } from './protocol.js';

type CommandItem = Extract<ThreadItem, { type: 'commandExecution' }>;

/**
 * A command Codex runs to look around shows as what it does: reads, searches and listings. Codex parses them itself, so
 * `cat a && cat b` is two reads.
 */
export function commandCall({ command, commandActions: actions }: CommandItem): ToolCall {
  const [first] = actions;

  if (actions.length > 0 && actions.every((action) => action.type === 'read')) {
    return { name: 'read', input: { files: actions.map((action) => ({ path: action.type === 'read' ? action.path : '' })) } };
  }

  if (actions.length === 1 && first?.type === 'search') {
    return { name: 'grep', input: { pattern: first.query ?? first.command, path: first.path ?? '.' } };
  }

  if (actions.length === 1 && first?.type === 'listFiles') return { name: 'glob', input: { pattern: first.path ?? first.command } };

  // A single action is the command as Codex parsed it, without the shell around it or its quoting.
  return { name: 'bash', input: { command: actions.length === 1 && first ? first.command : unwrapShell(command) } };
}

export function commandResult(call: ToolCall, item: CommandItem): ToolResult | undefined {
  const lines = outputLines(item.aggregatedOutput ?? '');

  switch (call.name) {
    case 'bash':
      return { exitCode: item.exitCode ?? (item.status === 'completed' ? 0 : 1), wallMs: item.durationMs ?? 0 };

    case 'glob':
      return { files: lines };

    case 'grep': {
      const matches = lines.flatMap((line): GrepMatch[] => {
        const found = /^(.+?):(\d+):(.*)$/.exec(line);

        return found ? [{ file: found[1]!, line: Number(found[2]), text: found[3]! }] : [];
      });

      return matches.length > 0 ? { matches } : { matches: [], files: lines };
    }

    default:
      return undefined;
  }
}

/** One per file, since Jinion shows an edit per file and Codex changes several in one patch. */
export function editCall({ path, kind, diff }: FileUpdateChange): ToolCall {
  switch (kind.type) {
    case 'add':
      return { name: 'edit', input: { path, patch: addPatch(diff), created: true } };
    case 'delete':
      return { name: 'edit', input: { path, patch: deletePatch(diff) } };
    case 'update':
      return { name: 'edit', input: { path: kind.move_path ?? path, patch: diff.replace(/\n$/, '') } };
  }
}

/** `/bin/zsh -lc 'ls packages'` shows as `ls packages`, as Codex itself shows it. */
export function unwrapShell(command: string) {
  const found = /^\S*\/(?:ba|z)?sh -lc (['"])([\s\S]*)\1$/.exec(command);
  if (!found) return command;

  const [, quote, inner = ''] = found;

  return quote === "'" ? inner.replaceAll(`'"'"'`, "'") : inner.replace(/\\(["\\$`])/g, '$1');
}

export function searchHits(results: unknown[] | null): SearchHit[] {
  return (results ?? []).flatMap((result) => {
    const { title, url } = (result ?? {}) as { title?: unknown; url?: unknown };

    return typeof url === 'string' ? [{ title: typeof title === 'string' ? title : url, url }] : [];
  });
}

/** The lines of what a tool printed, without the empty one after the last newline. */
export const outputLines = (text: string) => (text ? text.replace(/\n$/, '').split('\n') : []);

/** The text of an MCP tool's result, Jinion's own tools' or Codex's. */
export function contentText(content: unknown[] | null | undefined) {
  return (content ?? []).flatMap((part) => {
    const { type, text } = (part ?? {}) as { type?: unknown; text?: unknown };

    return (type === 'text' || type === 'inputText') && typeof text === 'string' ? [text] : [];
  });
}
