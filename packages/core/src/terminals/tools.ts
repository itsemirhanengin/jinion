import { z } from 'zod';
import type { ToolCall } from '../agent/tools.js';
import type { Terminals } from './terminals.js';
import type { TerminalInfo } from './types.js';

/** A tool the agent reaches the project's terminals with; each backend offers it its own way. */
export interface TerminalTool<S extends z.ZodRawShape = z.ZodRawShape> {
  description: string;
  input: S;
  run(input: z.infer<z.ZodObject<S>>): Promise<string>;
}

/** How long `run_in_terminal` waits before it answers with what the command printed so far. */
const FIRST_OUTPUT_MS = 4000;

const define = <S extends z.ZodRawShape>(tool: TerminalTool<S>) => tool;

/** `cwd` is where the conversation works, its worktree or the project, where a command it starts runs. */
export function terminalTools(terminals: Terminals, cwd: () => string) {
  return {
    terminals: define({
      description: "Lists the project's terminals: the user's own shells and the commands started with run_in_terminal, with whether each still runs.",
      input: {},
      run: async () => {
        const all = terminals.list();

        return all.length > 0 ? all.map(describe).join('\n') : 'No terminals are open.';
      },
    }),
    read_terminal: define({
      description: "Reads the last lines a terminal shows, as text: a dev server's log, a watcher's errors, or what the user ran in their own shell.",
      input: {
        id: z.string().describe('As `terminals` lists it, e.g. terminal-2.'),
        lines: z.number().int().min(1).max(2000).optional().describe('How many of the last lines; 200 when left out.'),
      },
      run: async ({ id, lines }) => {
        if (!terminals.has(id)) return `There is no terminal ${id}. Call terminals to list them.`;

        const text = await terminals.text(id, lines);

        return `${describe(terminals.info(id))}\n\n${text || '(nothing printed yet)'}`;
      },
    }),
    run_in_terminal: define({
      description:
        'Starts a command that keeps running, such as a dev server or a file watcher, in a terminal of the project that the user sees, and answers with what it printed in its first seconds. Read what it prints later with read_terminal. A command that finishes on its own goes through Bash instead.',
      input: { command: z.string().describe('Run in the user’s shell, in the folder this conversation works in.') },
      run: async ({ command }) => {
        const { id } = await terminals.open({ cwd: cwd(), command });

        await terminals.settle(id, FIRST_OUTPUT_MS);

        const info = terminals.info(id);
        const text = await terminals.text(id);
        const state = info.running ? `Started ${id}; it still runs.` : `Ran in ${id}; it ended with exit code ${info.exitCode}.`;

        return `${state}\n\n${text || '(nothing printed yet)'}`;
      },
    }),
  };
}

export type TerminalTools = ReturnType<typeof terminalTools>;

export type TerminalAction = keyof TerminalTools;

export const TERMINAL_ACTIONS = new Set<string>(['terminals', 'read_terminal', 'run_in_terminal'] satisfies TerminalAction[]);

/** A call of one of the tools as the conversation shows it, worded alike whichever backend made it. */
export function terminalCall(action: TerminalAction, input: unknown): ToolCall {
  const { command, id } = (input ?? {}) as { command?: unknown; id?: unknown };

  if (action === 'run_in_terminal') return { name: 'other', input: { title: 'Run in a terminal', detail: String(command ?? '') } };
  if (action === 'read_terminal') return { name: 'other', input: { title: 'Read a terminal', detail: String(id ?? '') } };

  return { name: 'other', input: { title: 'List the terminals' } };
}

function describe(terminal: TerminalInfo) {
  const who = terminal.agent ? 'started by you' : "the user's shell";
  const state = terminal.running ? 'running' : `ended with exit code ${terminal.exitCode}`;

  return `${terminal.id}: ${terminal.title} (${who}, ${state}) in ${terminal.cwd}`;
}
