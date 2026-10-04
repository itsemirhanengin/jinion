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
fail until then. The `@jinion` organization on npm is claimed. When the repository goes public, publish
`packages/core`, then `apps/cli` (which depends on it), each with `npm publish --access public`, since scoped packages
are private by default; `@jinion/tui` and `@jinion/virtualization` too, unless they get bundled into the CLI.

- **claude.ai login stays, knowingly.** The Agent SDK's overview says Anthropic doesn't allow third-party products,
  agents built on the SDK included, to offer claude.ai login or its rate limits unless it approved them. Jinion offers
  it without approval, as a decision taken knowing the risk: Anthropic could block such clients or act on the accounts.
  The docs and `/account` say plainly that it is a subscription login.
- **Signing in with an API key** comes first as the fallback, so Jinion keeps working if claude.ai login is closed:
  `ANTHROPIC_API_KEY` (and Bedrock or Vertex), which the SDK supports, picked in `/account`.
- **Later, paid plans.** Jinion may close claude.ai login and sell usage itself, as Cursor does, with requests going
  through a provider layer such as the Vercel AI SDK or OpenRouter. That is a second backend behind `Agent`, which the
  core's split into shared and per-session parts makes room for.

## Next

### A Codex adapter

A second `Agent` (`apps/cli/src/agent/agent.ts`) proves the interface holds. `agent/claude/` is the reference: models
with effort levels, modes, the event stream in and between turns, steering, background tasks, compaction, usage and
history. Optional parts of the interface stay optional, so the UI already copes with an agent that lacks them.

## Smaller items

- **Rewind's "Summarize from here" and "Summarize up to here".** Claude Code's rewind menu has them, but the Agent SDK
  (0.3.286) has no call for them. Add them to `panels/rewind/` once it does.
- **A real second account.** Switching accounts mid-conversation is built (`/account`) but was never checked end to end
  with a second signed-in login.
- **Claude Code's live diff panel.** In a wide terminal, Claude Code shows `/diff` beside the conversation and updates
  it while the agent works; Jinion's `/diff` is the full-screen viewer, as in Claude Code's classic renderer.

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

## Core and clients

The goal: a headless `packages/core` that holds everything but drawing, with the TUI as its first client and a desktop
app (Monaco, LSP, a real terminal) as its second. In the TUI: tabs, several conversations at once, a git panel, a
terminal and an editor of Jinion's own. Decided after mapping `apps/cli/src` and looking at OpenCode, Claude Code's SDK,
Codex's app-server, Zed's ACP and Goose:

- **One core holds many sessions.** A session is a conversation with its own agent process, store, queue, dialogs and
  worktree; the app holds what they share: settings, accounts, models, skills, MCP servers, memory, the session store.
- **The API is JSON-RPC 2.0 in both directions**, after Codex's app-server and LSP: the client sends requests, the
  core sends events as notifications with a sequence number per session, and asks the client for permissions and
  answers as requests of its own. Every message is defined once in zod; the TypeScript types and a JSON Schema come
  from it. `initialize` carries a protocol version and capabilities.
- **Three transports, one message layer.** In process for the TUI, so it stays as fast as today; stdio for a child
  process; WebSocket on 127.0.0.1 with a random token in a 0600 file and an Origin check for the desktop app (OpenCode's
  open server became CVE-2026-22812). Terminal panes get a stream of their own.
- **ACP comes as an adapter, not the core API.** Its sessions, prompts and permissions map onto ours, so `jinion acp`
  can reach Zed and JetBrains later; it has nothing for settings, git, memory or MCP.
- **`@jinion/tui` stays independent of core.** Core has its own types; they are shaped like the chat kit's, so the CLI
  passes one to the other without mapping.

Steps, each one leaving Jinion working as it does today:

1. **Untangle in place** (done). The core has its own types and helpers, loads jotai from `jotai/vanilla`, and opens
   views and dialogs as data; signing in, git status, a repository's changes, task output, MCP servers and the rewind
   guards moved out of panels and hooks.
2. **Move into `packages/core`** (done). `@jinion/core` holds `agent/`, `commands/`, `controllers/`, `conversation/`,
   `state/`, `settings/`, `memory/`, `mcp/`, `git/`, `prompt/`, `usage/` and `lib/` with their tests; `apps/cli` keeps
   `main.tsx`, `app/`, `panels/`, `ui/` and `status/`, and imports the core by module.
3. **Sessions** (done). `Jinion` is the app, holding the sessions open in it; `Session` is one conversation with its
   own atoms and controllers, and `state/active.ts` follows the one the user looks at. `AgentBackend` holds what the
   backend shares and asks for it through the process of a session that runs, so no process is started for it alone;
   `AgentSession` is one conversation's. Dialogs are a session's data, answered through it; a session the user isn't
   looking at still notifies. A conversation is never open twice, and a worktree is a choice made as a session opens,
   the setting being only the default. `/clear` and `/resume` replace the session the user looks at.
4. **The API**, with the in-process transport, and the TUI moved onto it; then stdio, WebSocket and `jinion serve`.
5. **Tabs in the TUI.** A tab bar, a session per tab, shortcuts, a mark on a tab that waits for an answer, `/resume`
   opening into a new tab.
6. **Panes in the TUI.** Splits in `@jinion/tui`; then the changes and git panel beside the conversation, with commits
   and comments on a diff line that go to the agent; a file tree; a terminal pane (a pseudo-terminal and an emulator);
   an editor of Jinion's own, reading first, then editing.
7. **The desktop app.** Electron, since the core runs on Node: the core in a utility process, Monaco, language servers,
   xterm.js. An editor core of Jinion's own may replace Monaco later.

Known before starting:

- **Several Jinions at once** write the same `settings.json`, `permissions.json` and session folder with read, change
  and write; a single core per user would remove the race.
- **claude.ai login** is offered without Anthropic's approval; see Going public.

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
the `claude` that comes with the SDK, so Jinion needs no Claude Code installed; claude.ai's skills, synced per account
by a short process of their own (`agent/claude/synced-skills.ts`). `git log` has the details.
