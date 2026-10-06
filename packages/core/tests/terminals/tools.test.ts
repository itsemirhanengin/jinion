import { tmpdir } from 'node:os';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { Terminals } from '../../src/terminals/terminals.js';
import { terminalCall, terminalTools } from '../../src/terminals/tools.js';

let terminals: Terminals;
let shell: string | undefined;

beforeEach(() => {
  shell = process.env.SHELL;
  process.env.SHELL = '/bin/sh';
  terminals = new Terminals();
});

afterEach(() => {
  terminals.closeAll();
  process.env.SHELL = shell;
});

test('runs a command in a terminal of the project and answers with what it printed', async () => {
  const tools = terminalTools(terminals, () => tmpdir());

  const answer = await tools.run_in_terminal.run({ command: 'echo ready on 3000; exit 2' });

  expect(answer).toBe('Ran in terminal-1; it ended with exit code 2.\n\nready on 3000');
  expect(terminals.list()).toEqual([expect.objectContaining({ id: 'terminal-1', agent: true, cwd: tmpdir() })]);
  await expect(tools.terminals.run({})).resolves.toContain('terminal-1: echo ready on 3000; exit 2 (started by you, ended with exit code 2)');
  await expect(tools.read_terminal.run({ id: 'terminal-1' })).resolves.toContain('\n\nready on 3000');
});

test('says which terminals there are when one asked for is not', async () => {
  const tools = terminalTools(terminals, () => tmpdir());

  await expect(tools.terminals.run({})).resolves.toBe('No terminals are open.');
  await expect(tools.read_terminal.run({ id: 'terminal-7' })).resolves.toBe('There is no terminal terminal-7. Call terminals to list them.');
});

test('words the calls the same for every backend', () => {
  expect(terminalCall('run_in_terminal', { command: 'pnpm dev' })).toEqual({ name: 'other', input: { title: 'Run in a terminal', detail: 'pnpm dev' } });
  expect(terminalCall('read_terminal', { id: 'terminal-2' })).toEqual({ name: 'other', input: { title: 'Read a terminal', detail: 'terminal-2' } });
  expect(terminalCall('terminals', {})).toEqual({ name: 'other', input: { title: 'List the terminals' } });
});
