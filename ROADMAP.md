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
missing from the reference pages.

Every page is in Turkish too, addressing the reader as "siz": headings keep the English anchors
(`## Kurulum [#install]`), links go to `/tr/...`, and the screens stay as the app draws them. Search stems Turkish with
a tokenizer of its own (`lib/turkish-tokenizer.ts`), since zbsearch's folds ğ, ı and ş away before the stemmer sees
them. A change to an English page needs the same change in its `.tr.mdx`. What is left:

- **Chinese and Russian**, the same way as Turkish. Chinese needs no stemmer, but words aren't split by spaces, so its
  search needs a look of its own.
- **Screens that refresh themselves.** The screens in the pages were captured from the demo app in the test terminal,
  with each cell's color turned into the theme's name; that capture could become a script to run when the TUI changes.
- **Developer docs**, in their own tab.

## Going public

The repository is private, and `@jinion/cli` isn't on npm yet, so the docs' install command and their links to GitHub
fail until then. The `@jinion` organization on npm is claimed. When the repository goes public, drop
`"private": true` from `apps/cli` (it keeps the CLI from being published by mistake until then) and run
`pnpm changeset publish`, which publishes each package whose version isn't on npm yet as public, since scoped packages
are private by default; `@jinion/tui` and `@jinion/virtualization` go too, unless they get bundled into the CLI.

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

### The desktop app

`apps/desktop`, the core's second client, in Electron. What was decided before starting it:

- **Electron**, since the core is Node and runs in Electron's own Node processes as it is; Monaco, xterm.js and
  node-pty, which the IDE side needs, are at home there, as VS Code and Cursor show. Tauri would need the core as a Node
  sidecar and bridges for the terminal and LSP.
- **A window per project, a core per window.** The core works in one folder (`info.cwd`: its settings, memory and saved
  conversations), so a window opens one project, as in VS Code. A projects screen lists the recent ones and opens a
  folder.
- **Three kinds of process.** The main process holds the windows, menus and updates, and draws nothing. Each window's
  core runs in a `utilityProcess`, so a busy core never stalls a window or another project. The renderer is a client
  like the TUI, a `JinionClient` from `@jinion/core/api/client`. The two talk over a `MessagePort` the main process
  hands to both ends, a transport next to the in-process, stdio and WebSocket ones, so no port is open and no token is
  needed (`connectWebSocket` uses Node's `ws` and can't run in a renderer anyway). The renderer is sandboxed with
  context isolation; its preload only passes the port.
- **The design system is `packages/ui`**, as `@jinion/tui` is for the terminal. `@jinion/ui` (the theme and
  primitives) and `@jinion/ui/chat` (messages, tool views, the diff card, todos, the composer, the ask, permission and
  plan panels) know nothing about Jinion; their types are their own, shaped like the core's, so the app passes one to
  the other. Tailwind v4 for the styles, Base UI for menus, dialogs and popovers, lucide for icons, the system font.
  The look follows Jinion's earlier design: a light sidebar of threads, the open ones as tabs, the conversation in a
  centered column, a composer with the mode, model, permissions and branch under it.
- **Two modes in one window**, as Cursor has: Agent, with the conversation in the middle and the code out of the way,
  as in the earlier design; IDE, with the editor in the middle, the file tree, a terminal below and the conversation
  beside it. Agent comes first.
- **Threads are sessions.** The sidebar lists the project's saved conversations (`saved/list`), the tabs are the open
  sessions (`sessions/*`), each with whether it works and the lines it changed.

Steps, design first, as the TUI was built:

1. **Design.** `packages/ui` and a playground (`pnpm dev:ui`) that draws each piece from sample conversations, then
   the Agent screen as a whole.
2. **The shell.** `apps/desktop`: the core with the demo backend in a utility process, the `MessagePort` transport, and
   the renderer drawing the demo's scenarios live through the API, with streaming, dialogs and tabs.
3. **Real work.** The real backends, the projects screen, sign-in, models, modes and permissions, worktrees and the
   branch from the composer, notifications, a Mac app's menus and shortcuts.
4. **IDE mode.** Monaco with the files the agent touches, the file tree, a terminal (xterm.js over node-pty, on a stream
   of its own, as planned for terminal panes), diffs to review; LSP after.
5. **Shipping.** Signed and notarized builds, updates read from an address of their own (GitHub marks one release
   "Latest" for both products), `@jinion/desktop` on its own version, from 0.2.0.

### Codex, the rest

The Codex adapter (`agent/codex/`) works through `codex app-server`, which every conversation shares, each as a
thread. `@openai/codex` is a pinned dependency, since the adapter uses the protocol's experimental parts (plan mode,
Jinion's note tools as dynamic tools, Codex's questions); bumping it means running `codex app-server generate-ts
--experimental`, comparing with `agent/codex/protocol.ts`, and recording the fixtures again (`pnpm --filter
@jinion/core codex-fixture`). What Claude has and Codex doesn't yet:

- **`ctrl+b`.** Codex decides itself which commands go on in the background, so there is nothing to send there.
- **What always asks, in Auto.** Codex's reviewer answers for commits and writes outside the project there, so
  `/commit-approval` doesn't apply; the other modes ask through Codex's sandbox. The app-server has no hook before
  the reviewer, and its notifications about it only report; a `PreToolUse` hook in Codex's own config could ask, but
  it is the user's file and needs their trust.
- **A model change during a turn** applies from the next one: `turn/settings/update` takes it only with
  `step_model_switching`, a feature Codex lists as under development. Auto coming or going applies at once.

### More backends

`/model` lists every backend's models under its name, and a model of another moves the conversation there with a
handover: the new backend gets the conversation so far as text with its next prompt (`conversation/handoff.ts`). Kimi,
OpenCode's models or local ones would come in the same way, as an `AgentBackend` added in `apps/cli/src/host.ts`.

## Smaller items

- **Rewind's "Summarize from here" and "Summarize up to here".** Claude Code's rewind menu has them, but the Agent SDK
  (0.3.286) has no call for them. Add them to `panels/rewind/` once it does.
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
- **The API is JSON-RPC 2.0 in both directions**, after Codex's app-server and LSP, with ACP-like method names
  (`session/submit`, `dialog/answer`). A client follows a session from a snapshot, then gets each action the reducer
  takes, numbered per session, and replays it with the same pure reducer; what isn't the conversation (dialog, tasks,
  mode, queue, ...) comes as named field changes. A dialog is session data any client can answer, so one that
  reconnects still sees it. The client is thin: slash commands run in the core, and the `Screen` port becomes
  notifications to the client that asked. `initialize` carries a protocol version.
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
4. **The API**, in four parts:
   - **4a** (done): the protocol, a JSON-RPC peer both sides use, the in-process transport, `JinionServer` and
     `JinionClient`, tested end to end on the demo backend: a client following a turn holds the conversation the
     server holds, and starts over from a snapshot when a change goes missing.
   - **4b** (done): the TUI is a client of the core, in process: `main.tsx` starts a `JinionServer` and the app draws
     from a `JinionClient`'s store, following every open session. The draft, the history, pastes and the status line's
     layout are the app's; everything else, from git and files to sign-in and task output, comes over the API, and
     `biome.jsonc` keeps it that way.
   - **4c** (done): `jinion serve` runs the core without a screen, on a WebSocket on 127.0.0.1 with a random token in
     a 0600 file under `~/.jinion/servers` and an Origin check, or over stdio (`--stdio`), a JSON message per line.
     `jinion --attach` shows its conversations; leaving keeps them running.
   - **4d** (done): the data that crosses the API is defined once, in zod, and the types come from it; the protocol
     names every method's params and result and every notification, and `schema/api.json` is made from it, with 71
     named definitions. Every API test checks what the server sends against it. A version is raised only for a change
     that breaks a client: adding keeps it.
5. **Tabs in the TUI** (done). A session per tab; the bar shows from two tabs on, with a spinner on one that works and
   `?` on one that waits on the user, and takes clicks. `ctrl+n` or `/tab` opens a tab, `alt+1..9` goes to one,
   `/close` closes it, and `/resume` opens into a new tab. A worktree per tab only when worktrees are on.
6. **The desktop app**, under Next.

Known before starting:

- **Several Jinions at once** (done). Files they share change through `updateJson`, which applies the change to what
  is on disk under a lock file (`lib/file-lock.ts`); four processes adding 40 each to a counter lost 114 of 160 without
  it. A conversation is open in one process at a time: `sessions/<id>.open` holds its pid, and another Jinion refuses it
  (`ApiCode.openElsewhere`), pointing at `jinion --attach` for a `jinion serve`. A single core per user isn't needed for
  this; following one live conversation from two windows comes with the desktop app.
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
by a short process of their own (`agent/claude/synced-skills.ts`); Codex as a second backend, picked in `/model`, with
the conversation handed over between them. `git log` has the details.
