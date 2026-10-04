import { existsSync, mkdirSync, readdirSync, realpathSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { projectSlug } from '../../lib/paths.js';
import { claudeConfigDir } from './paths.js';

/** Claude Code finds a conversation under the folder it works in, so its transcript follows a move, as on leaving a worktree. */
export function followTranscript(sessionId: string, cwd: string) {
  const projects = join(claudeConfigDir(), 'projects');
  const file = `${sessionId}.jsonl`;
  const target = join(projects, projectSlug(realPath(cwd)));
  if (existsSync(join(target, file))) return;

  const source = safeEntries(projects)
    .map((folder) => join(projects, folder))
    .find((folder) => existsSync(join(folder, file)));

  if (!source) return;

  mkdirSync(target, { recursive: true });
  renameSync(join(source, file), join(target, file));

  // Subagents' transcripts and saved tool results.
  if (existsSync(join(source, sessionId)) && !existsSync(join(target, sessionId))) renameSync(join(source, sessionId), join(target, sessionId));
}

function realPath(path: string) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

function safeEntries(folder: string) {
  try {
    return readdirSync(folder);
  } catch {
    return [];
  }
}
