import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYS, renderTerminal, type TestTerminal } from '@jinion/tui/testing';
import { darkTheme, hoverColor } from '@jinion/tui';
import type { TodoStatus } from '@jinion/tui/chat';
import { demoCommands } from '../agent/demo/commands.js';
import { scenarios } from '../agent/demo/scenarios/index.js';
import { ScriptedAgent } from '../agent/demo/agent.js';
import type { AgentAccount, AgentAccounts } from '../agent/accounts.js';
import { contextWarning, hasWorkLeft } from './activity.js';
import { App } from './app.js';
import { MemoryStore } from '../memory/store.js';
import { MemorySessionStore } from '../conversation/store.js';
import { git, repo } from '../test/git.js';
import { sandbox, type Sandbox } from '../test/sandbox.js';

let box: Sandbox;
let terminal: TestTerminal;

function start(pace: number, rows = 40) {
  terminal?.unmount();

  terminal = renderTerminal(
    <App
      agent={new ScriptedAgent(scenarios, demoCommands, pace)}
      info={{ version: '0.0.0', cwd: box.project, examples: ['hello'] }}
      sessions={new MemorySessionStore()}
      memory={new MemoryStore(box.project)}
    />,
    { columns: 120, rows },
  );
}

beforeEach(() => {
  box = sandbox();
  start(0);
});

afterEach(() => {
  vi.restoreAllMocks();
  terminal.unmount();
  box.restore();
});

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

  it('sends what is typed while the agent works after its turn, when the agent can’t take it into the turn', async () => {
    start(1);
    await terminal.waitFor('Ask jinion anything');
    await terminal.type('hello');
    await terminal.press(KEYS.enter);
    await terminal.waitFor('Type to queue');
    await terminal.type('hey again');
    await terminal.press(KEYS.enter);
    await terminal.waitFor('queued: hey again');
    const screen = await terminal.waitFor(/> hey again[\s\S]*Ask jinion anything/, 15_000);

    expect(screen).not.toContain('queued:');
  });

  it('goes back to before an earlier message with esc twice, and puts it back in the prompt', async () => {
    for (const message of ['hello', 'hey again']) {
      await terminal.waitFor('Ask jinion anything');
      await terminal.type(message);
      await terminal.press(KEYS.enter);
      await terminal.waitFor(new RegExp(`> ${message}[\\s\\S]*Ask jinion anything`));
    }

    await terminal.press(KEYS.escape, KEYS.escape);
    const list = await terminal.waitFor('+- Rewind 2 messages');

    expect(list).toMatch(/> 1\. hey again +\|\n\| +No file changes since then +\|\n\| +2\. hello/);

    await terminal.press(KEYS.enter);
    // Without file changes to take back, Claude Code's menu offers the conversation only.
    const choices = await terminal.waitFor('Never mind');

    expect(choices).toContain('Restore conversation');
    expect(choices).not.toContain('Restore code');

    await terminal.press(KEYS.enter);
    const screen = await terminal.waitFor('The conversation went back to before “hey again”');

    expect(screen).toContain('> hello');
    expect(screen).not.toContain('> hey again');
    expect(screen).toMatch(/^ hey again$/m);
  });

  it('clears what is typed with esc twice, keeping it in the history', async () => {
    await terminal.waitFor('Ask jinion anything');
    await terminal.type('half a thought');
    await terminal.press(KEYS.escape, KEYS.escape);
    const cleared = await terminal.waitFor('Ask jinion anything');

    expect(cleared).not.toContain('Rewind');

    await terminal.press(KEYS.up);
    expect(await terminal.waitFor(/^ half a thought$/m)).not.toContain('Ask jinion anything');
  });

  it('puts what was queued back in the prompt when the turn is interrupted', async () => {
    start(1);
    await terminal.waitFor('Ask jinion anything');
    await terminal.type('hello');
    await terminal.press(KEYS.enter);
    await terminal.waitFor('Type to queue');
    await terminal.type('run the linter after');
    await terminal.press('\x11');
    await terminal.waitFor('queued: run the linter after');
    await terminal.press(KEYS.escape);
    const screen = await terminal.waitFor('Interrupted');

    expect(screen).toMatch(/^ run the linter after$/m);
    expect(screen).not.toContain('queued:');
  });

  it('sums up a finished subagent, and shows its calls on a click', async () => {
    // Tall enough to keep the subagent in view above the question that follows it.
    start(0, 80);
    await terminal.waitFor('Ask jinion anything');
    await terminal.type('add rate limiting to the api');
    await terminal.press(KEYS.enter);
    const screen = await terminal.waitFor('Where should the limiter keep its counters?');

    expect(screen).toContain('[x] Agent · Map how a request reaches a route');
    expect(screen).toMatch(/3 tool calls · [\d.]+s$/m);

    await terminal.click('3 tool calls');
    const expanded = await terminal.waitFor('Grep app.use · 2 matches');

    expect(expanded).toContain('Glob src/**/*.ts · 41 files');
    expect(expanded).toContain('Read src/server.ts');
  });

  it('plays the tour through its questions, edits and commands', async () => {
    const screen = await playTour();

    expect(screen).toContain('src/middleware/rate-limit.ts');
    expect(screen).not.toContain('Interrupted');
  });

  it('folds thinking and command output once the turn is over, and opens one at a time on a click', async () => {
    start(0, 80);
    const screen = await playTour();

    expect(screen).toMatch(/^ Thought for \d+s$/m);
    expect(screen).toMatch(/^\| … \+15 lines +\|$/m);
    expect(screen).toMatch(/^\| … \+7 lines +\|$/m);
    expect(screen).not.toContain('Test Files  8 passed (8)');

    await terminal.hover('+15 lines');
    await terminal.waitFor('+15 lines');
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(await terminal.backgroundOf('+15 lines')).toBe(hoverColor(darkTheme, darkTheme.surface.success));
    expect(await terminal.backgroundOf('+7 lines')).toBe(darkTheme.surface.success);

    await terminal.click('+15 lines');
    const opened = await terminal.waitFor('Test Files  8 passed (8)');

    expect(opened).toMatch(/^\| … \+7 lines +\|$/m);

    await terminal.click('Test Files  8 passed (8)');
    await terminal.waitFor(/^\| … \+15 lines +\|$/m);

    await terminal.click('Thought for');
    await terminal.waitFor('The reset test fails at the boundary.');

    await terminal.press('\x0f');
    const all = await terminal.waitFor('Test Files  8 passed (8)');

    expect(all).toContain('Tests  3 passed (3)');
  });

  it('ends a turn that changed files with a card of them, and opens a file’s diff from it on a click', async () => {
    start(0, 80);
    await playTour();
    const card = await terminal.waitFor('4 files changed +63 -4');

    expect(card).toMatch(/^\| src\/middleware\/rate-limit\.ts +new \+30 -1 +\|$/m);
    expect(card).toMatch(/^\| src\/server\.ts {26}\+2 -1 +\|$/m);

    await terminal.hover('| src/server.ts', 2);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(await terminal.backgroundOf('| src/server.ts', 2)).toBe(hoverColor(darkTheme));
    expect(await terminal.backgroundOf('| src/server.ts', 60)).toBeUndefined();

    await terminal.click('| src/server.ts', 2);
    await terminal.waitFor(/Diff src\/server\.ts[\s\S]*rateLimit/);
    await terminal.press(KEYS.escape);
    await terminal.waitFor('“add rate limiting to the api” · 4 files · +63 -4');
  });

  it('selects text with the mouse, copies it on release with a note over the prompt, and copies again on ctrl+c', async () => {
    await terminal.type('hello');
    await terminal.press(KEYS.enter);
    await terminal.waitFor(/the mouse wheel[\s\S]*Ask jinion anything/);

    await terminal.drag('the mouse wheel', 'the mouse wheel', 4, 14);
    expect(terminal.clipboard()).toEqual(['mouse wheel']);

    const copied = await terminal.waitFor('copied 11 chars to clipboard');

    expect(copied).toMatch(/^-+ copied 11 chars to clipboard ---$/m);
    expect(await terminal.backgroundOf('mouse wheel')).toBe(darkTheme.selectionBackground);
    expect(await terminal.backgroundOf('the mouse wheel')).not.toBe(darkTheme.selectionBackground);

    // ctrl+c copies rather than quitting, and lets go of the selection.
    await terminal.press(KEYS.ctrlC);
    expect(terminal.clipboard()).toEqual(['mouse wheel', 'mouse wheel']);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(await terminal.backgroundOf('mouse wheel')).not.toBe(darkTheme.selectionBackground);
    expect(await terminal.screen()).toContain('Ask jinion anything');

    await terminal.multiClick('commands, skills', 2, 2);
    expect(terminal.clipboard().at(-1)).toBe('commands');
    await terminal.multiClick('scrolls the conversation', 3);
    expect(terminal.clipboard().at(-1)).toBe('- the mouse wheel or pgup/pgdn scrolls the conversation');

    await terminal.type('x');
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(await terminal.backgroundOf('scrolls the conversation')).not.toBe(darkTheme.selectionBackground);
  });

  it('keeps the task list above the prompt while it has work left, and not once it is all done', () => {
    const list = (...statuses: TodoStatus[]) => [{ title: 'Tasks', items: statuses.map((status, index) => ({ text: `task ${index}`, status })) }];

    expect(hasWorkLeft(list('done', 'active', 'pending'))).toBe(true);
    expect(hasWorkLeft(list('pending'))).toBe(true);
    expect(hasWorkLeft(list('done', 'done'))).toBe(false);
    expect(hasWorkLeft([])).toBe(false);
  });

  it('shows the changes in each repository of a folder that holds several, and a file’s diff on enter', async () => {
    repo(join(box.project, 'api'), (path) => box.write(join(path, 'server.ts'), 'listen(3000)\n'));
    repo(join(box.project, 'web'), (path) => box.write(join(path, 'index.html'), '<h1>hi</h1>\n'));
    repo(join(box.project, 'docs'), (path) => box.write(join(path, 'index.md'), '# docs\n'));
    box.write(join(box.project, 'api', 'server.ts'), 'listen(8080)\n');
    box.write(join(box.project, 'web', 'app.css'), 'h1 {}\nbody {}\n');

    await terminal.waitFor('Ask jinion anything');
    await terminal.type('/diff');
    await terminal.press(KEYS.enter);

    const list = await terminal.waitFor('app.css');

    expect(list).toContain('3 repositories · 2 files · +3 -1');
    expect(list).toMatch(/^\| api main +\|$/m);
    expect(list).toMatch(/^\| > +server\.ts +\+1 -1 +\|$/m);
    expect(list).toMatch(/^\| web main +\|$/m);
    expect(list).toMatch(/^\| +app\.css +new \+2 +\|$/m);
    expect(list).toMatch(/^\| No changes in docs\. +\|$/m);

    await terminal.press(KEYS.enter);
    const diff = await terminal.waitFor('listen(8080)');

    expect(diff).toContain('api/server.ts');
    expect(diff).toContain('listen(3000)');

    await terminal.press(KEYS.escape);
    await terminal.waitFor('3 repositories');
    await terminal.press(KEYS.escape);
    await terminal.waitFor('Ask jinion anything');
  });

  it('goes through the turns in which the agent changed files with left and right, each with just its edits', async () => {
    await playTour();
    await terminal.type('/diff');
    await terminal.press(KEYS.enter);
    const current = await terminal.waitFor('Left/Right turn');

    expect(current).toMatch(/ Current +add rate limiting to th… /);

    await terminal.press(KEYS.right);
    const turn = await terminal.waitFor('“add rate limiting to the api”');

    expect(turn).toMatch(/^\| > src\/middleware\/rate-limit\.ts +new \+\d+ -1 +\|$/m);
    expect(turn).toMatch(/^\| {3}src\/server\.ts +\+\d+ -\d+ +\|$/m);

    await terminal.press(KEYS.enter);
    // The header shows before the diff is read.
    await terminal.waitFor(/Diff src\/middleware\/rate-limit\.ts[\s\S]*Middleware/);
    await terminal.press(KEYS.escape);
    await terminal.press(KEYS.left);
    await terminal.waitFor(/Changes .*There is no git repository|There is no git repository here/);
  });

  it('shows what the branch adds to the default branch when nothing is uncommitted', async () => {
    repo(box.project, (path) => box.write(join(path, 'a.ts'), 'one\n'));
    git(box.project, 'checkout', '-qb', 'limits');
    box.write(join(box.project, 'limit.ts'), 'export const limit = 100;\n');
    git(box.project, 'add', '-A');
    git(box.project, 'commit', '-qm', 'limit');

    await terminal.waitFor('Ask jinion anything');
    await terminal.type('/diff');
    await terminal.press(KEYS.enter);
    const list = await terminal.waitFor('limit.ts');

    expect(list).toContain('limits · what it adds to main · 1 file · +1 -0');
    expect(list).toMatch(/^\| > limit\.ts +new \+1 +\|$/m);
  });

  it('marks the files the agent changed in the diff', async () => {
    repo(box.project, (path) => {
      box.write(join(path, 'src', 'server.ts'), 'app.listen()\n');
      box.write(join(path, 'README.md'), '# api\n');
    });

    await playTour();
    // The demo agent doesn't write, so the test changes what it says it did, and a file it didn't touch.
    box.write(join(box.project, 'src', 'server.ts'), 'app.use(limit)\napp.listen()\n');
    box.write(join(box.project, 'README.md'), '# api, rate limited\n');
    await terminal.type('/diff');
    await terminal.press(KEYS.enter);

    const list = await terminal.waitFor('2 files');

    expect(list).toMatch(/^\| > README\.md +\+1 -1 +\|$/m);
    expect(list).toMatch(/^\| {3}src\/server\.ts +\+1 +agent \|$/m);
  });

  it('keeps a dev server running in the background, shows it above the prompt and in ctrl+t, and stops it with x', async () => {
    await terminal.waitFor('Ask jinion anything');
    await terminal.type('start the dev server');
    await terminal.press(KEYS.enter);
    const screen = await terminal.waitFor(/ctrl\+t shows its output[\s\S]*Ask jinion anything/);

    expect(screen).toContain('[In the background | ctrl+t to see it]');
    expect(screen).toMatch(/^ bg \[.\] pnpm dev \d+s · ctrl\+t$/m);

    await terminal.press('\x14');
    const panel = await terminal.waitFor('Server listening on http://localhost:3000');

    expect(panel).toMatch(/\| > 1\. \[.\] pnpm dev +\d+s \|/);
    expect(panel).toContain('x stop');

    await terminal.press('x');
    await terminal.waitFor('The dev server is stopped.');
    await terminal.press(KEYS.escape);
    const after = await terminal.waitFor(/The dev server is stopped\.[\s\S]*Ask jinion anything/);

    expect(after).toMatch(/\[-\] Background pnpm dev · stopped after/);
    expect(after).not.toMatch(/^ bg /m);
  });

  it('looks at tests that failed in the background on its own, and notifies about them', async () => {
    // Slow enough that the tests end after the turn that started them, as with a real agent.
    start(1);
    await terminal.waitFor('Ask jinion anything');
    await terminal.focus(false);
    await terminal.type('run the tests in the background');
    await terminal.press(KEYS.enter);
    await terminal.waitFor(/I'll tell you how they did once they finish\.[\s\S]*Ask jinion anything/, 10_000);
    const screen = await terminal.waitFor(/The check should use `?>=`?\.[\s\S]*Ask jinion anything/, 15_000);

    expect(screen).toMatch(/\[!\] Background pnpm vitest run · failed after [\d.]+s · exit 1/);
    expect(terminal.notifications()).toContain('jinion · project: Background command failed: pnpm vitest run');
  });

  it('shows the plan’s limits and what adds to them in /usage, and the days of use as a calendar on tab', async () => {
    start(0, 44);
    await terminal.waitFor('Ask jinion anything');
    await terminal.type('/usage');
    await terminal.press(KEYS.enter);
    const usage = await terminal.waitFor('Most used: Explore subagent 5%');

    expect(usage).toMatch(/^\| 5-hour window +\[=+-+\] +43% resets /m);
    expect(usage).toMatch(/^\| Subagent-heavy +\[=+\] +98% each subagent makes requests of its own/m);
    expect(usage).toContain('This session $1.42');

    await terminal.press('w');
    await terminal.waitFor('last 7 days');
    await terminal.press(KEYS.tab);
    const stats = await terminal.waitFor('Favorite model');

    expect(stats).toMatch(/^\| Mon (■ ){52}■ +\|$/m);
    expect(stats).toMatch(/^\| Favorite model +Opus 5\.5 +Tokens +[\d.]+[MB] +\|$/m);
    expect(stats).toMatch(/^\| Opus 5\.5 +\[=+-+\] +60\.0% /m);
    expect(stats).toContain('(today)');

    await terminal.press(KEYS.left);
    await terminal.waitFor(/^\| (?!.*today)\w{3} \d+ · /m);
    await terminal.press('r');
    await terminal.waitFor(/Active days +\d+ of [1-3]\d\b/);
    await terminal.press('r');
    await terminal.waitFor(/Active days +\d of [1-7]\b/);
    await terminal.press(KEYS.escape);
    await terminal.waitFor('Ask jinion anything');
  });

  it('compacts the conversation with /compact, marking where, with the summary on a click', async () => {
    await terminal.waitFor('Ask jinion anything');
    await terminal.type('/compact');
    await terminal.press(KEYS.enter);
    await terminal.waitFor('There is nothing to compact yet.');
    await terminal.type('hello');
    await terminal.press(KEYS.enter);
    await terminal.waitFor(/> hello[\s\S]*Ask jinion anything/);

    await terminal.type('/compact the API changes');
    await terminal.press(KEYS.enter);
    const marked = await terminal.waitFor(/\[x\] Compacted · [\d.k]+ → [\d.k]+ tokens$/m);

    expect(marked).not.toContain('> /compact');

    await terminal.click('Compacted');
    await terminal.waitFor('Kept in focus: the API changes.');
  });

  it('names the conversation after what it is about as it moves on, and keeps a name given with /rename', async () => {
    const statusLine = (screen: string) => screen.trimEnd().split('\n').at(-1)!;

    const send = async (text: string) => {
      await terminal.type(text);
      await terminal.press(KEYS.enter);
      await terminal.waitFor(new RegExp(`> ${text}[\\s\\S]*Ask jinion anything`));
    };

    await terminal.waitFor('Ask jinion anything');
    await terminal.type('/rename');
    await terminal.press(KEYS.enter);
    await terminal.waitFor('There is nothing to name yet.');

    await send('hello');
    expect(statusLine(await terminal.waitFor(/Say hello\s*$/))).toContain('Say hello');

    await send('start the dev server');
    await terminal.waitFor(/Start the dev server\s*$/);

    await terminal.type('/rename Release prep');
    await terminal.press(KEYS.enter);
    await terminal.waitFor('Renamed the conversation to “Release prep”.');
    // The fourth message would have it named again, but the user's name stays.
    await send('hello');
    await send('hey');
    expect(statusLine(await terminal.screen())).toContain('Release prep');

    await terminal.type('/rename');
    await terminal.press(KEYS.enter);
    await terminal.waitFor('Named the conversation “Say hello”. It is named again as it moves on.');
    expect(statusLine(await terminal.screen())).toContain('Say hello');
  });

  it('shows what fills the context in /context, a square per percent', async () => {
    await terminal.waitFor('Ask jinion anything');
    await terminal.type('/context');
    await terminal.press(KEYS.enter);
    const panel = await terminal.waitFor('Autocompact buffer');

    expect(panel).toMatch(/^\| (■ ){9}■ +■ System prompt +2\.1k tokens · 1% +\|$/m);
    expect(panel).toContain('Compacts on its own at 167.0k tokens (84%)');
    expect(panel).toContain('loaded when used, so they take no room yet: MCP tools 31.2k');

    await terminal.press(KEYS.escape);
    await terminal.waitFor('Ask jinion anything');
  });

  it('warns under the prompt as the context nears auto-compaction', () => {
    const usage = { contextTokens: 100_000, contextWindow: 200_000, cost: 0, compactAt: 167_000 };

    expect(contextWarning(usage)).toBeUndefined();
    expect(contextWarning({ ...usage, contextTokens: 150_300 })).toBeCloseTo(0.1);
    expect(contextWarning({ ...usage, compactAt: undefined, contextTokens: 199_000 })).toBeUndefined();
  });

  it('notifies when it waits for an answer in a window that isn’t focused, and not while it is', async () => {
    await terminal.waitFor('Ask jinion anything');
    await terminal.focus(false);
    await terminal.type('add rate limiting to the api');
    await terminal.press(KEYS.enter);
    await terminal.waitFor('Where should the limiter keep its counters?');
    expect(terminal.notifications()).toEqual(['jinion · project: jinion asks: Where should the limiter keep its counters?']);

    await terminal.focus(true);
    await terminal.press(KEYS.enter);
    await terminal.waitFor('Which routes should be limited?');
    expect(terminal.notifications()).toHaveLength(1);
  });

  it('signs an account in again with l, and removes one with d twice, but not the own login or the one in use', async () => {
    const logins: AgentAccount[] = [
      { name: 'default', own: true, signedIn: true, email: 'me@example.com', plan: 'Max' },
      { name: 'old', signedIn: true, email: 'old@example.com', plan: 'Pro' },
      { name: 'work', signedIn: true, email: 'me@acme.co', plan: 'Pro' },
    ];

    const used: string[] = [];

    const accounts: AgentAccounts = {
      current: 'work',
      active: async () => logins.find((login) => login.name === 'work')!,
      list: async () => logins,
      use: async (name) => void used.push(name),
      signIn: async (name) => ({ ...logins.find((login) => login.name === name)!, email: 'new@acme.co' }),
      remove: async (name) => void logins.splice(logins.findIndex((login) => login.name === name), 1),
    };

    const agent = Object.assign(new ScriptedAgent(scenarios, demoCommands, 0), { accounts });

    terminal.unmount();

    terminal = renderTerminal(
      <App agent={agent} info={{ version: '0.0.0', cwd: box.project, examples: [] }} sessions={new MemorySessionStore()} memory={new MemoryStore(box.project)} />,
      { columns: 120, rows: 40 },
    );

    await terminal.waitFor('Ask jinion anything');
    await terminal.type('/account');
    await terminal.press(KEYS.enter);
    await terminal.waitFor('d remove');

    await terminal.press(KEYS.up, KEYS.up);
    await terminal.press('d');
    await terminal.waitFor("Demo's own login stays; l signs in again");
    await terminal.press(KEYS.down, KEYS.down);
    await terminal.press('d');
    await terminal.waitFor('in use; switch to another account first');

    await terminal.press('l');
    await terminal.waitFor('Signed in to work again as new@acme.co. The conversation carries on with the new login.');
    expect(used).toEqual(['work']);

    await terminal.press(KEYS.up);
    await terminal.press('d');
    await terminal.waitFor('press d again to remove');
    await terminal.press('d');
    const removed = await terminal.waitFor('Removed the old account and signed it out. Its conversations stay.');

    expect(removed).not.toContain('old@example.com');
  });

  it('notifies when a long turn ends, unless notifications are off', async () => {
    // Slow enough that the turn is still going when the clock jumps.
    start(1);
    await terminal.waitFor('Ask jinion anything');
    await terminal.focus(false);
    const now = Date.now;

    await terminal.type('hello');
    await terminal.press(KEYS.enter);
    await terminal.waitFor('Type to queue');
    vi.spyOn(Date, 'now').mockImplementation(() => now() + 20_000);
    await terminal.waitFor(/> hello[\s\S]*Ask jinion anything/, 15_000);
    expect(terminal.notifications()).toEqual([expect.stringMatching(/^jinion · project: Done with “hello” after 2\ds\.$/)]);

    await terminal.type('/notifications');
    await terminal.press(KEYS.enter);
    await terminal.waitFor('Notifications are off.');
    await terminal.type('hello again');
    await terminal.press(KEYS.enter);
    await terminal.waitFor(/> hello again[\s\S]*Ask jinion anything/, 15_000);
    expect(terminal.notifications()).toHaveLength(1);
  });
});

async function playTour() {
  await terminal.waitFor('Ask jinion anything');
  await terminal.type('add rate limiting to the api');
  await terminal.press(KEYS.enter);
  await terminal.waitFor('Where should the limiter keep its counters?');
  await terminal.press(KEYS.enter);
  await terminal.waitFor('Which routes should be limited?');
  await terminal.press(KEYS.enter);
  await terminal.waitFor('Which checks should run');
  await terminal.press(' ', KEYS.enter);

  return terminal.waitFor(/One thing left open[\s\S]*Ask jinion anything/, 10_000);
}
