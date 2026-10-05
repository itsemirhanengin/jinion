import { z } from 'zod';

export const Repo = z.object({
  root: z.string(),
  /** `''` when the project is in this repository. */
  path: z.string(),
  label: z.string(),
});

export type Repo = z.infer<typeof Repo>;

export const RepoState = z.object({
  /** The short commit when HEAD is detached. */
  branch: z.string(),
  changed: z.number(),
  ahead: z.number(),
  behind: z.number(),
});

export type RepoState = z.infer<typeof RepoState>;

export const FileChange = z.object({
  file: z.string(),
  absolute: z.string(),
  kind: z.enum(['modified', 'added', 'deleted', 'renamed', 'untracked']),
  insertions: z.number(),
  deletions: z.number(),
  binary: z.boolean(),
  /** In uncommitted changes, how much of the file's change is staged; absent when none is. */
  staged: z.enum(['all', 'some']).optional(),
});

export type FileChange = z.infer<typeof FileChange>;

export const RepoChanges = z.object({
  repo: Repo,
  branch: z.string().optional(),
  changes: z.array(FileChange),
  /** With nothing uncommitted, what the branch adds on top of the default branch. */
  since: z.object({ base: z.string(), against: z.string() }).optional(),
});

export type RepoChanges = z.infer<typeof RepoChanges>;

export const GitStatus = z.object({ repos: z.array(RepoState.extend({ repo: Repo })) });

export type GitStatus = z.infer<typeof GitStatus>;

export const Worktree = z.object({
  name: z.string(),
  branch: z.string(),
  /** The worktree's root. */
  path: z.string(),
  /** The project's folder in it, deeper than `path` when Jinion was started below the repository's root. */
  folder: z.string(),
  /** The checkout it was made from, which runs the commands that remove it. */
  repo: z.string(),
  /** The commit it started from, to tell the commits made in it. */
  base: z.string(),
});

export type Worktree = z.infer<typeof Worktree>;
