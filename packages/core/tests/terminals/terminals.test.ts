import { tmpdir } from 'node:os';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { Terminals } from '../../src/terminals/terminals.js';
import type { TerminalOutput } from '../../src/terminals/types.js';

let terminals: Terminals;
let shell: string | undefined;

beforeEach(() => {
  // The user's own shell would read their startup files; a plain one keeps what is written the same everywhere.
  shell = process.env.SHELL;
  process.env.SHELL = '/bin/sh';
  terminals = new Terminals();
});

afterEach(() => {
  terminals.closeAll();
  process.env.SHELL = shell;
});

test('keeps what the agent ran, with how it ended, and reads it as text', async () => {
  const { id, agent, title } = await terminals.open({ cwd: tmpdir(), command: 'printf "one\\ntwo\\n"; exit 3' });

  await terminals.settle(id, 5000);

  expect({ agent, title }).toEqual({ agent: true, title: 'printf "one\\ntwo\\n"; exit 3' });
  expect(terminals.info(id)).toMatchObject({ running: false, exitCode: 3 });
  expect(await terminals.text(id)).toBe('one\ntwo');
});

test('reads a line written over as it shows last, as a progress bar does', async () => {
  const { id } = await terminals.open({ cwd: tmpdir(), command: 'printf "10%%\\r99%%\\ndone\\n"' });

  await terminals.settle(id, 5000);

  expect(await terminals.text(id)).toMatch(/^99%\ndone/);
});

test('gives a prompt once the agent’s command ends, ctrl+c included, and keeps how it ended', async () => {
  const { id } = await terminals.open({ cwd: tmpdir(), command: 'echo started; sleep 30' });

  await until(async () => (await terminals.text(id)).includes('started'));
  terminals.write(id, '\x03');
  await terminals.settle(id, 5000);

  expect(terminals.info(id)).toMatchObject({ running: false, exitCode: 130 });

  terminals.write(id, 'echo "still $((20 + 22))"\r');
  await until(async () => (await terminals.text(id)).includes('still 42'));

  expect(terminals.has(id)).toBe(true);
});

test("a user's shell takes input, and goes once it exits", async () => {
  const changes: number[] = [];

  terminals.onChange((list) => changes.push(list.length));

  const { id, agent } = await terminals.open({ cwd: tmpdir() });

  terminals.write(id, 'echo "hi from $((40 + 2))"\r');
  await until(async () => (await terminals.text(id)).includes('hi from 42'));
  terminals.write(id, 'exit\r');
  await until(async () => !terminals.has(id));

  expect(agent).toBe(false);
  expect(changes).toEqual([1, 0]);
});

test('numbers the output, so a screen read says how far it goes', async () => {
  const output: TerminalOutput[] = [];

  terminals.onOutput((each) => output.push(each));

  const { id } = await terminals.open({ cwd: tmpdir(), command: 'printf "a\\n"; sleep 0.1; printf "b\\n"' });

  await terminals.settle(id, 5000);

  const { screen, seq } = await terminals.screen(id);

  expect(output.map((each) => each.seq)).toEqual(output.map((_, index) => index + 1));
  expect(seq).toBe(output.at(-1)?.seq);
  expect(screen).toContain('a\r\nb');
});

async function until(check: () => Promise<boolean> | boolean, ms = 5000) {
  const end = Date.now() + ms;

  while (!(await check())) {
    if (Date.now() > end) throw new Error('Timed out waiting.');

    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
