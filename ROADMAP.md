# Roadmap

What is left to build, in the order suggested, with what is already known about each. Where Claude Code has the
feature, Jinion follows how it behaves and what it calls things (look it up in its docs first), and improves on the
look where that helps.

Before calling anything done: `pnpm typecheck`, `pnpm lint`, `pnpm test`, then `pnpm build` and a real check through
the installed `jinion` command, which runs `apps/cli/dist`, not `pnpm dev`.

## Docs (in progress)

`apps/docs` is the documentation site, Fumadocs on Next.js, deployed as docs.jinion.co with the pages at the root
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

Steps:

1. **The skeleton** (done): English and Turkish, the sidebar with every page's title and description, the `terminal`
   code block for screens, Jinion's look. `apps/docs/README.md` says how pages are written.
2. **Reference**: CLI flags and environment variables, commands, keyboard shortcuts, the `~/.jinion` folder,
   troubleshooting. Most of it moves over from the README.
3. **Get started**: the introduction with a first session in three steps, installation, how Jinion works.
4. **Guides**: the Use Jinion and Customize pages.
5. **Wrap up**: shorten the README to point at the docs, deploy to docs.jinion.co.

Steps 2 to 4 have a first draft on every page, written from the README and the code so the site has real content for
its design. Still to do on them: go through each against the code, add what landed after them (`/rename` and
conversation titles, signing an account in again and removing one from `/account`), and decide whether the reference tables get a test that fails when a command or shortcut is missing.
The screens in the pages were captured from the demo app in the test terminal, with each cell's color turned into the
theme's name; that capture could become a script that refreshes them when the TUI changes.

Known before the Turkish pages come: search matches whole Turkish words only (`bellek` doesn't find `belleği`), since
the search engine Fumadocs ships stems English alone. Turkish needs a stemmer passed to `createFromSource` in
`app/api/search/route.ts`.

## Next

### 1. The repository's own conventions in AGENTS.md

Jinion now works on itself, and it reads the project's `AGENTS.md` and `CLAUDE.md` into its system prompt
(`apps/cli/src/agent/claude/prompt.ts`). Today `AGENTS.md` only has Turborepo's managed block, so the conventions live
in no file. Worth writing down, outside the managed block:

- Plain ASCII drawing (`+`, `-`, `|`, `|--`); `■` only for heatmap and waffle squares.
- Comment and naming style: comments say why, in full sentences; names read as English.
- Tests: Vitest, the `@jinion/tui/testing` terminal for screens, recorded fixtures (`pnpm fixture`) for Claude Code's
  messages, `FakeClaude` for the process; a real check through the built `jinion` at the end.
- Match Claude Code's behavior for features it has; commits as a subject line and `- ` bullets, no trailers.

### 2. Richer tool views

WebFetch, WebSearch and MCP tool calls show as a single line today (`other` in `apps/cli/src/agent/claude/events.ts`,
drawn by `ToolView` in `apps/cli/src/ui/entry.tsx`). Claude Code shows what came back: a fetch's URL, size and status, a
search's result titles, an MCP tool's result in short. Give them their own tool kinds in `agent/types.ts`, map their
results in `events.ts`, and draw a short preview that `ctrl+o` expands, like command output.

### 3. Worktrees

Each task in its own git worktree, so several conversations can work on one repository at once without stepping on
each other. Claude Code has this (worktree sessions, `EnterWorktree`); look up how it creates, names and cleans them up
before designing Jinion's. Touches where Claude Code is started (`agent/claude/options.ts`, its `cwd`), the session
store, `/diff` and the status line, which should say which worktree a conversation is in.

### 4. A Codex adapter

A second `Agent` (`apps/cli/src/agent/types.ts`) proves the interface holds. `agent/claude/` is the reference: models
with effort levels, modes, the event stream in and between turns, steering, background tasks, compaction, usage and
history. Optional parts of the interface stay optional, so the UI already copes with an agent that lacks them.

## Smaller items

- **Rewind's "Summarize from here" and "Summarize up to here".** Claude Code's rewind menu has them, but the Agent SDK
  (0.3.286) has no call for them. Add them to `panels/rewind.tsx` once it does.
- **Skills synced from claude.ai** (pdf, docx, ...) don't reach Jinion. Find out how Claude Code loads them, then hand
  them over in `agent/claude/plugins.ts` with the rest.
- **A real second account.** Switching accounts mid-conversation is built (`/account`) but was never checked end to end
  with a second signed-in login.
- **Claude Code's live diff panel.** In a wide terminal, Claude Code shows `/diff` beside the conversation and updates
  it while the agent works; Jinion's `/diff` is the full-screen viewer, as in Claude Code's classic renderer.

## Known and left as they are

- **Auto-compaction** maps the same messages as `/compact`, which were checked live; the automatic run itself needs a
  context of about 167k tokens and wasn't triggered for real.
- **`/stats` tokens** come out lower than Claude Code's: Jinion counts each response once (Claude Code writes a line
  per block of a response, each with the whole usage). Days, sessions, streaks and models match.
- **The usage call** behind `/usage` is marked experimental in the SDK; only `agent/claude/usage.ts` touches it.

## Done

Tests, lint, CI and `--debug`; the agent split into process, approvals and events, with events between turns; images,
steering and the queue, rewind; the subagent tree, `/diff` across folders of repositories, notifications; background
tasks; `/usage` and `/stats`; the guard for commands that write outside the project; `/compact` and `/context`; `/diff`'s
turn views. `git log` has the details.
