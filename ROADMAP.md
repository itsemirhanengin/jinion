# Roadmap

What is left to build, in the order suggested, with what is already known about each. Where Claude Code has the
feature, Jinion follows how it behaves and what it calls things (look it up in its docs first), and improves on the
look where that helps.

Before calling anything done: `pnpm typecheck`, `pnpm lint`, `pnpm test`, then `pnpm build` and a real check through
the installed `jinion` command, which runs `apps/cli/dist`, not `pnpm dev`.

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
