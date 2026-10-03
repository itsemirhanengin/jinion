import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { KEYS, renderTerminal, type TestTerminal } from '@jinion/tui/testing';
import { demoCommands, scenarios } from './agent/scenarios.js';
import { ScriptedAgent } from './agent/scripted.js';
import { App } from './app.js';
import { MemoryStore } from './memory/store.js';
import { MemorySessionStore } from './session-store.js';
import { sandbox, type Sandbox } from './test/sandbox.js';

/** The whole app in an emulated terminal, with the demo agent playing its scenarios without pauses. */
let box: Sandbox;
let terminal: TestTerminal;

beforeEach(() => {
  box = sandbox();
  terminal = renderTerminal(
    <App
      agent={new ScriptedAgent(scenarios, demoCommands, 0)}
      info={{ version: '0.0.0', cwd: box.project, examples: ['hello'] }}
      sessions={new MemorySessionStore()}
      memory={new MemoryStore(box.project)}
    />,
    { columns: 120, rows: 40 },
  );
});

afterEach(() => {
  terminal.unmount();
  box.restore();
});

/** The lines under the lowest rule: the completion list, its hints and the status line. */
const below = (screen: string) => {
  const lines = screen.split('\n');
  const rule = lines.findLastIndex((line) => line.startsWith('---'));
  return lines.slice(rule + 1).map((line) => line.trimEnd()).filter(Boolean);
};

describe('App', () => {
  it('opens on the banner and the prompt', async () => {
    const screen = await terminal.waitFor('Ask jinion anything');
    expect(screen).toContain('jinion v0.0.0');
    expect(screen).toContain('/ commands · $ skills · @ files');
  });

  it('lists Jinion’s commands after / and the agent’s skills after $', async () => {
    await terminal.waitFor('Ask jinion anything');
    await terminal.type('/');
    const commands = below(await terminal.waitFor('/model'));
    expect(commands.some((line) => line.includes('$review'))).toBe(false);

    await terminal.press(KEYS.backspace);
    await terminal.type('$');
    const skills = below(await terminal.waitFor('github prompts'));
    expect(skills.slice(0, 5)).toEqual([
      '   Project',
      ' >   review               Review the current changes for bugs and risky patterns',
      '   Yours',
      '     commit               Write a commit message for the staged changes',
      '     explain <path>       Explain how a piece of code works',
    ]);
  });

  it('sends skills mentioned anywhere in a message, highlighted', async () => {
    await terminal.waitFor('Ask jinion anything');
    await terminal.type('please $review it and $commit');
    expect(await terminal.colorOf('$review')).toBeDefined();
    await terminal.press(KEYS.enter);
    const screen = await terminal.waitFor('stop here');
    expect(screen).toContain('Read .claude/skills/review/SKILL.md');
    expect(screen).toContain('Read .claude/skills/commit/SKILL.md');
  });

  it('puts a skill typed after / back in the prompt with $', async () => {
    await terminal.waitFor('Ask jinion anything');
    await terminal.type('/review the diff');
    await terminal.press(KEYS.escape, KEYS.enter);
    const screen = await terminal.waitFor('Skills go after $ now');
    expect(screen).toMatch(/^ \$review the diff$/m);
  });

  it('plays the tour through its questions, edits and commands', async () => {
    await terminal.waitFor('Ask jinion anything');
    await terminal.type('add rate limiting to the api');
    await terminal.press(KEYS.enter);
    await terminal.waitFor('Where should the limiter keep its counters?');
    await terminal.press(KEYS.enter);
    await terminal.waitFor('Which routes should be limited?');
    await terminal.press(KEYS.enter);
    await terminal.waitFor('Which checks should run');
    await terminal.press(' ', KEYS.enter);
    // The prompt comes back when the turn is over.
    const screen = await terminal.waitFor(/One thing left open[\s\S]*Ask jinion anything/, 10_000);
    expect(screen).toContain('src/middleware/rate-limit.ts');
    expect(screen).not.toContain('Interrupted');
  });
});
