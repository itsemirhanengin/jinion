# Roadmap

What is left to build, in the order suggested, with what is already known about each. Where Claude Code has the
feature, Jinion follows how it behaves and what it calls things (look it up in its docs first), and improves on the
look where that helps.

Before calling anything done: `pnpm typecheck`, `pnpm lint`, `pnpm test`, then `pnpm build` and a real check through
the installed `jinion` command, which runs `apps/cli/dist`, not `pnpm dev`.

## Docs

`apps/docs` is the documentation site, Fumadocs on Next.js, live at docs.jinion.co with the pages at the root
(`pnpm dev:docs`). What was decided before writing it, after looking at how Claude Code, Codex, Cursor, OpenCode, Amp
and Gemini CLI document themselves:

- **Jinion is its own tool.** The docs never present it as running under Claude Code; a Claude login is a requirement,
  stated where requirements go.
- **Installed from npm** as `npm i -g @jinion/cli`, written as if the package were already published.
- **English at the root, Turkish under `/tr`**, as `page.tr.mdx` next to `page.mdx`. An untranslated page shows the
  English one. A page is translated once its English has settled.
- **Plain and clear**, like the README: short sentences, second person, the expected result after each step. Guides
  are titled by task, reference pages are tables, troubleshooting is titled by the symptom. Prompts to the agent go in
  `text` blocks, shell commands in `sh`.
- **Each topic in one place**, about twenty pages in four sections: Get started, Use Jinion, Customize, Reference.
- **Screens as text.** A `<Terminal>` component shows Jinion's screens as ASCII rather than screenshots, so they follow
  the theme and can be searched; later they can come from the app itself through `@jinion/tui/testing`.
- **Developer docs** (the TUI framework, architecture, backends, tests) come after the user docs, in their own tab.

Every English page is written and checked against the code, and the README points at the docs.
`tests/commands/builtin.test.ts` and `tests/app/shortcuts.test.ts` in `apps/cli` fail when a command or shortcut is
missing from the reference pages. What is left:

- **The Turkish pages.** Search matches whole Turkish words only (`bellek` doesn't find `belleği`), since the search
  engine Fumadocs ships stems English alone; Turkish needs a stemmer passed to `createFromSource` in
  `app/api/search/route.ts`.
- **Screens that refresh themselves.** The screens in the pages were captured from the demo app in the test terminal,
  with each cell's color turned into the theme's name; that capture could become a script to run when the TUI changes.
- **Developer docs**, in their own tab.

## Going public

The repository is private, and `@jinion/cli` isn't on npm yet, so the docs' install command and their links to GitHub
fail until then. The `@jinion` organization on npm is claimed. When the repository goes public, publish from
`apps/cli` with `npm publish --access public`, since scoped packages are private by default.

## Next

### A Codex adapter

A second `Agent` (`apps/cli/src/agent/agent.ts`) proves the interface holds. `agent/claude/` is the reference: models
with effort levels, modes, the event stream in and between turns, steering, background tasks, compaction, usage and
history. Optional parts of the interface stay optional, so the UI already copes with an agent that lacks them.

## Smaller items

- **Rewind's "Summarize from here" and "Summarize up to here".** Claude Code's rewind menu has them, but the Agent SDK
  (0.3.286) has no call for them. Add them to `panels/rewind/` once it does.
- **Skills synced from claude.ai** (pdf, docx, ...) don't reach Jinion. Find out how Claude Code loads them, then hand
  them over in `agent/claude/plugins.ts` with the rest.
- **A real second account.** Switching accounts mid-conversation is built (`/account`) but was never checked end to end
  with a second signed-in login.
- **Claude Code's live diff panel.** In a wide terminal, Claude Code shows `/diff` beside the conversation and updates
  it while the agent works; Jinion's `/diff` is the full-screen viewer, as in Claude Code's classic renderer.
- **The `/stats` calendar test depends on the day.** `tests/app/app.test.tsx` expects a fixed number of squares in the
  Monday row, which changes with the weekday the test runs on; it needs a fixed date.
- **Messages that name Claude Code.** `agent/claude/auth.ts` (removing an account), `agent/claude/agent.ts` (restoring
  files) and `panels/usage/section.tsx` (the summary days come from) show "Claude Code" on screen. Removing an account
  is also worded differently in `/account remove` and in the panel.
## Later: a system prompt sized to the request

Most of the quota a small request spends goes to the frame around it: a long system prompt, then lint, typecheck,
tests and a build to change one word. The idea: before a turn, a cheap model (Haiku, as `agent/claude/title.ts` already
uses for titles) reads the request and judges how much it asks for. "Change GitHUB to GitHub in the sidebar" gets a
lean prompt and no verification beyond looking at the change; a detailed task, or a small change made 150 times, gets
the full frame with its checks. What is known so far:

- The prompt is set once, when the Claude Code process starts (`systemPrompt` in `agent/claude/options.ts`). Changing it
  between turns means a new process, and a different prompt misses the prompt cache, which can cost more than it
  saves. The first request of a conversation could pick the prompt, and later turns get a short note in the message
  instead.
- The classification itself is a call; it has to be quick and cheap enough to be worth it on every request.
- Measure before and after on the same tasks with `/usage`, so the saving is a number rather than a feeling.

## Later: Jinion as a full IDE

The end goal is an IDE in the terminal: the agent, a code editor and a shell side by side, in tabs, over more than one
project at once. It isn't one step but the direction the items above lead to, so the work before it should leave room
for it rather than build it early. What it takes:

- **Tabs.** Several conversations, editors and shells open at once, each in its own tab, with a tab bar and shortcuts
  to move between them. Today the app is one conversation on the whole screen, with panels on top of it.
- **More than one project.** Each tab belongs to a project folder, with its own session store, `/diff`, git state and
  instruction files. Worktrees, turned on with `ctrl+g`, are the first step: several conversations on one repository.
- **An editor.** Open a file from the conversation, from `/diff` or from a file tree, move around it, change it and save
  it, with syntax colors from the theme. The prompt's editor (`packages/tui/src/chat/prompt/`) and `/diff`'s
  file view are the pieces closest to it today.
- **A terminal.** A real shell in a tab or a split, running in a pseudo-terminal and drawn through a terminal emulator
  inside Jinion, so full-screen programs like `vim` or `htop` work in it too.
- **Splits.** A conversation next to the file it is changing, or next to a shell, like Claude Code's live diff panel
  beside the conversation (in Smaller items).

## Known and left as they are

- **Auto-compaction** maps the same messages as `/compact`, which were checked live; the automatic run itself needs a
  context of about 167k tokens and wasn't triggered for real.
- **`/stats` tokens** come out lower than Claude Code's: Jinion counts each response once (Claude Code writes a line
  per block of a response, each with the whole usage). Days, sessions, streaks and models match.
- **The usage call** behind `/usage` is marked experimental in the SDK; only `agent/claude/usage.ts` touches it.
- **The system prompt** (`BASE` in `agent/claude/prompt.ts`) was written after Claude Code's; what the model doesn't
  follow is noted while Jinion is used and tightened in one go.
- **Railway deploys** come from `.railway/railway.ts`, which can't hold watch patterns, so every push to `main`
  rebuilds the docs and the website. Changes to the file take effect with `railway config apply`, run by hand.

## Done

Tests, lint, CI and `--debug`; the agent split into process, approvals and events, with events between turns; images,
steering and the queue, rewind; the subagent tree, `/diff` across folders of repositories, notifications; background
tasks; `/usage` and `/stats`; the guard for commands that write outside the project; `/compact` and `/context`;
`/diff`'s turn views; thinking and command output that fold once done, and open one at a time on a click, lit up under
the pointer; the card of what a turn changed, each file opening its diff; selecting text with the mouse, copied on
release; web fetches, searches and MCP calls shown with what came back; a git worktree per conversation, opt-in with
`ctrl+g`; a fuller system prompt after Claude Code's; the codebase restructured into controllers over a jotai store,
with its conventions in `AGENTS.md`; the docs at docs.jinion.co and the page at jinion.co, on Railway; signing in with
the `claude` that comes with the SDK, so Jinion needs no Claude Code installed. `git log` has the details.
