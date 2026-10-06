import type { TerminalInfo } from '@jinion/core/api/protocol';
import { Spinner } from '@jinion/ui';
import { Bot, SquareTerminal } from 'lucide-react';

/** The agent's terminals apart from the user's own shells. */
export function TerminalMark({ terminal }: { terminal: TerminalInfo }) {
  const Icon = terminal.agent ? Bot : SquareTerminal;

  return <Icon className="size-4 shrink-0 text-faint" aria-label={terminal.agent ? 'Started by the agent' : undefined} />;
}

/** What the agent ran, while it runs and how it ended; a shell waiting on the user says nothing. */
export function TerminalStatus({ terminal }: { terminal: TerminalInfo }) {
  if (!terminal.agent) return <span className="ml-auto" />;
  if (terminal.running) return <Spinner className="ml-auto shrink-0 text-primary" />;
  if (terminal.exitCode) return <span className="ml-auto shrink-0 font-mono text-mono text-removed">exit {terminal.exitCode}</span>;

  return <span className="ml-auto shrink-0 text-faint">done</span>;
}

/** The folder as it sits in the project, under the project's name; one outside it, as a worktree is, in full. */
export function folderOf(cwd: string, project: string) {
  const name = project.slice(project.lastIndexOf('/') + 1);

  if (cwd === project) return name;
  if (cwd.startsWith(`${project}/`)) return `${name}${cwd.slice(project.length)}`;

  return cwd;
}
