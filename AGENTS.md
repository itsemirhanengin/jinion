<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->

# Jinion

A coding agent in the terminal. `packages/core` is Jinion without a screen, `apps/cli` the terminal app (`jinion`) that
drives it, `packages/tui` the terminal UI framework the app is built on (Ink and React), `packages/virtualization` the
list virtualizer under its scroll view, `packages/ui` the design system of the desktop app to come (React and Tailwind,
drawn in its playground with `pnpm dev:ui`), `packages/spacing` the checker for the vertical layout below, `apps/docs`
the docs site, `apps/website` the page at jinion.co. `ROADMAP.md` has what is left to build, the desktop app first.

## Architecture

Dependencies point down this list; nothing lower imports from higher up. The app imports the core by module, as
`@jinion/core/api/client`, and reaches it only through the API, as any client does.

| Folder | What lives there |
| --- | --- |
| `apps/cli/src/main.tsx`, `host.ts`, `serve.ts` | Flags; the core's options from them (`coreOptions`) and the core in this process (`startCore`); then `run(<App />)` on it, `jinion serve` without a screen, or `jinion --attach` to a running server. The only files of the app that build the core. |
| `apps/cli/src/app/` | The React shell: `App` connects a `JinionClient` (following every open session), initializes it and provides it as `useApi()` with the client's store; `Layout` is the conversation, aside, prompt and status line; `keys.ts` the app's shortcuts (listed in `shortcuts.ts`); `views.tsx` and `dialogs.tsx` draw the views and dialogs the core asks for. |
| `apps/cli/src/state/` | The app's atoms, derived from the client's store: the shown session's conversation and fields, and the app's fields. |
| `apps/cli/src/panels/` | One component per panel, a folder for one with several parts. A new panel gets a `View` in the core's `controllers/context.ts` and a case in `app/views.tsx`. |
| `apps/cli/src/prompt/` | What the user types, which is the client's: each session's draft and the history (`draft.ts`; the core only puts text in a draft, through `Screen.fillPrompt`), pasted text and images (`attachments.ts`), and `usePrompt`, which sends them as a `Submission`. |
| `apps/cli/src/ui/` | Pieces drawn in the conversation (`ui/entries/`, one file per entry or tool kind), the banner, small UI hooks (`use-async`, `use-pager`). |
| `apps/cli/src/status/` | The status line: one segment per object in `segments/`, the data they draw from in `data.ts`. |
| `packages/core/src/api/` | The API clients drive the core through: JSON-RPC 2.0 (`rpc.ts`, one peer for both sides) over a `Transport`: in process (`transport.ts`), a line per message over streams (`stream-transport.ts`, for stdio), or WebSocket on 127.0.0.1 with a token and an Origin check (`websocket.ts`, its address and token in `server-file.ts`); every method's params and result and every notification in `protocol.ts`, in zod, with the API's own shapes in `schemas.ts` and the JSON Schema clients in other languages use made from them (`json-schema.ts`, written to `schema/api.json` by `pnpm --filter @jinion/core schema`); `server.ts` over one `Jinion` with a `Connection` per client, whose handlers are in `methods/`, one file per area, and `client.ts`, which holds what the server tells it in its own store. A client follows a session from a snapshot, then replays its numbered actions with the same reducer; the rest is named fields (`fields.ts`). `client.ts` takes only types and the reducer from the core, so a client carries no app of its own. |
| `packages/core/src/commands/` | Slash commands, one file per group, in `builtin.ts` in palette order. A command gets the `Jinion` and calls controllers or opens a view (`screen.openView({ id: 'model' })`). |
| `packages/core/src/controllers/` | What the app does, as plain classes. `jinion.ts` is the app: its backends, each with what its sessions share (accounts, MCP, models, skills), the sessions open in it (`openSession`, `activate`, `close`; a conversation is never open twice) and the one the user looks at; `session.ts` is one conversation, on one backend that `/model` can change, with its turns and queue, dialogs, conversation, worktree, model, mode, tasks and input. They reach the screen only through the `Screen` port in `context.ts`. |
| `packages/core/src/state/` | Jotai atoms in one store, the single source of truth for what changes. What sessions share is global (`agent.ts`, `preferences.ts`); each session has its own set from `sessionAtoms()`. Clients don't read them: they hold what the API tells them in a store of their own. Derived values are derived atoms; choices that outlive a run are `persistedAtom`s. |
| `packages/core/src/conversation/` | The conversation as data: entry types, the pure reducer, edits and titles, the session store. No React, unit-tested. The reducer gets the time with each action and numbers entries from the conversation's own count, so replaying the same actions anywhere gives the same conversation; a session sends every action through its one `dispatch`. |
| `packages/core/src/agent/` | The backend contract (`agent.ts`, `events.ts`, `tools.ts`, ...) and its implementations: `claude/` drives Claude Code headless, `codex/` drives Codex through its app-server, `demo/` plays scripted scenarios for `--demo` and the app tests. |
| `packages/core/src/` `settings/`, `memory/`, `mcp/`, `git/`, `prompt/`, `usage/` | Files on disk and outside tools, each behind a small module. |
| `packages/core/src/lib/` | Generic helpers: formatting (`format.ts`), text, errors, JSON files, paths, fuzzy matching, dates. |

Rules that keep it that way:

- **State lives in atoms; behavior lives in controllers.** Components read the app's atoms with `useAtomValue` and call
  the core through `useApi()`, which never changes, so reading it never redraws: `api.inSession(method, params)` for the
  session shown, `api.request` for the app, and `api.act(call)` for a call nothing waits on, so a failure shows as a
  notice. Don't put app state in `useState` when more than one component needs it.
- **The app is a client.** Whatever another client would need, a desktop app or a phone, goes through the API, so a
  panel never reads the core's files, git or settings itself; what only this app needs, such as the draft or the
  status line's layout, stays in the app.
- **What crosses the API is defined once, in zod.** A data type a client gets is a schema with the type inferred from
  it under the same name (`export const Entry = z.object(...)`, `export type Entry = z.infer<typeof Entry>`), in a module
  that loads nothing from Node, so a client in a browser can load it too. Every API test checks what the server sends
  against these schemas (`checked` in `tests/support/api.ts`), and a test fails when `schema/api.json` is stale.
- **Versions: add, don't break.** A new method, notification or optional field keeps `PROTOCOL_VERSION`, and clients
  ignore what they don't know. Removing or renaming any, or making a field required, raises it.
- **A session keeps to its own atoms.** Its controllers read and write `context.atoms`, so one running in the
  background never touches another.
- **`@jinion/core` draws nothing.** It imports no React, Ink, `@jinion/tui` or jotai's root entry (`jotai/vanilla`
  instead); `biome.jsonc` checks it, and checks that the app reaches the core only through the API. Views a command
  opens go through `Screen` as data (`View`). What a session asks the user is data too: the dialog it waits on is in its
  atoms (`atoms.dialog`), a client draws it from the session's fields, and answers it with `dialog/answer`. Its types are its own; the chat kit's are shaped the same, so the app passes one to
  the other as they are.
- **Backends stay behind `AgentBackend` and `AgentSession`.** A backend holds what its conversations share (models,
  accounts, MCP servers, skills, usage); `backend.session()` opens one conversation, with its own process. The app only
  uses `agent/agent.ts` and its sibling contract files; anything Claude Code specific stays in `agent/claude/`. Optional
  members are feature-detected, with a notice when missing.
- **`@jinion/tui` knows nothing about Jinion.** Generic pieces come from `@jinion/tui`, the chat kit (messages, tool
  views, composer, ask/permission/plan panels) from `@jinion/tui/chat`. It has no state library; its stores use
  `useSyncExternalStore`.
- **`@jinion/ui` knows nothing about Jinion either.** It is the same for the desktop: primitives and the window's
  pieces from `@jinion/ui`, the chat kit from `@jinion/ui/chat`, the tokens in `theme.css`. Its types are its own,
  shaped like the core's. The agent's markdown goes through `Prose`, which never renders raw HTML.
- **One concern per file**, named after it. Split a file when it holds unrelated things, not to hit a line count.
- **Reuse before writing**: `lib/format.ts` for numbers, durations and plurals, `lib/text.ts`, `errorMessage`,
  `useAsync` for a promise in a component, `usePager` for scrolled full-screen views.

## Code

- TypeScript, ESM with `.js` import suffixes, `import type` for types. `pnpm lint` (Biome) and `pnpm typecheck`.
- Names read as plain English. No abbreviations.
- Almost no comments. No doc comments that restate a name, type or signature, no module headers. A comment is a
  single line saying a non-obvious why: a Claude Code quirk, a workaround, a constraint the code can't show.
- No overengineering: an abstraction earns its place by being used more than once or by making the code clearly
  simpler.
- The look is plain ASCII (`+`, `-`, `|`, `|--`); `■` only for heatmap and waffle squares.
- Where Claude Code has a feature, match its behavior and wording; improve the look where that helps.

## Vertical layout

Code reads in paragraphs: lines that belong together touch, a new thought starts after one blank line. `pnpm lint`
checks the rules below with `packages/spacing`, and `pnpm lint:fix` applies them.

- A blank line before `return` and `throw`, unless it is the only statement in its block.
- A blank line after a group of declarations. A one-line guard (`if (!value) return;`) stays right under the value it
  checks, and a blank line follows it.
- A blank line around any statement or declaration that spans lines.
- A blank line after the imports, between top-level declarations that span lines, and between class members that span
  lines.
- The cases of a switch are spaced alike: all apart once one of them spans lines, all together otherwise; cases that
  fall through stay together.
- No blank line at the start or end of a block, never two in a row.

What the checker can't judge, keep by hand:

- Components in sections, a blank line between each: context and store reads, state and refs, derived values, effects
  and input, handlers, early returns, then the JSX.
- Long functions in paragraphs where the thought changes, related lines kept together rather than spaced out.
- Files from the top down: the main export first, the helpers it uses below it. In classes: fields, constructor,
  public methods, private methods.

## Tests

- Tests live in each package's `tests/` folder, mirroring `src/`: the tests of `src/agent/claude/events.ts` are in
  `tests/agent/claude/events.test.ts`, with their fixtures and snapshots beside them. Shared helpers (`sandbox`,
  `FakeClaude`, `git`) are in the core's `tests/support/`, which the app's tests import as `@jinion/core/testing/sandbox`.
  Nothing in `src/` imports from `tests/`. `@jinion/tui/testing` stays in `src/testing`, since it is a public entry of
  the package.
- Vitest. Run with `NODE_ENV=development` if your shell sets it to production, or `@jinion/tui/testing` won't resolve.
- Screens: `renderTerminal` from `@jinion/tui/testing`, against the demo agent (`tests/app/app.test.tsx`). Tests read the
  screen as the user would; keep its text stable or update them on purpose.
- Claude Code's messages: recorded fixtures in the core's `tests/agent/claude/fixtures` (`pnpm --filter @jinion/core
  fixture`, in `scripts/fixture.ts`, turns a `--debug` log into one) and `FakeClaude` for the process.
- Codex's: the same in `tests/agent/codex/fixtures` (`pnpm --filter @jinion/core codex-fixture`), and `FakeCodex`, an
  app-server that plays a fixture a turn at a time.
- Before calling something done: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, then a real check through
  the installed `jinion`, which runs `apps/cli/dist`.

## Commits

One line in Conventional Commits style that says what changed, e.g. `feat(cli): add /rename`,
`fix(tui): keep hover on the item under the pointer`, `refactor(cli): move app state to jotai`. No body, no trailers, no
co-author lines. Split a large change into several commits, one per logical part.

## Branches

Work happens on a branch, one per piece of work that earns a line in a changelog: a feature, a fix, a translation. It
is named after its commit type, as `feat/desktop-app`, `fix/codex-rewind`, `docs/russian`. The steps of that work are
commits on the same branch, not branches of their own. The branch goes into `main` through a pull request once CI
passes, merged by rebase so its commits land as they are, once the user approves. A very small change, such as a typo
or a one-line fix, can go straight to `main`.

## Versions and releases

Changesets keeps the versions. `core`, `cli`, `tui`, `ui` and `virtualization` each have their own; `docs`, `website` and
`spacing` have none (`ignore` in `.changeset/config.json`). The products are what users install: `@jinion/cli` now, the
desktop app later. Each has its own version and releases on its own; they aren't kept in step.

- A branch that changes a published package carries a changeset for it: a file in `.changeset/` naming each package
  with `patch` or `minor`, and the line for its changelog (`pnpm changeset` asks the same in a terminal). The bump is
  agreed with the user before the merge.
- A changeset names every product the change reaches, not only the packages it touches: a fix in `core` that both
  products show names `@jinion/core`, `@jinion/cli` and the desktop app. A product that depends on a bumped package
  gets a patch by itself, but its changelog then says only "Updated dependencies".
- Under 1.0, `minor` is a release worth naming (the desktop app with its core makes 0.2.0), `patch` everything else.
- A release is a commit on `main`: `pnpm changeset version` raises the versions and writes each package's
  `CHANGELOG.md`, then `pnpm changeset git-tag` tags each package, as `@jinion/cli@0.2.0`. It takes every changeset waiting
  on `main`, which is one more reason only finished work is merged.
- A GitHub release is made for a product's tag only, titled with the product (`Jinion CLI 0.2.0`), with that version's
  section of the product's `CHANGELOG.md` as its notes; the desktop app's carries its installers. The other packages
  get tags and no release. Tags and releases go out once the user approves.
- GitHub marks one release "Latest", whichever product came last, so the desktop app's updater reads an address of its
  own rather than the latest release.
- `PROTOCOL_VERSION` is separate: it follows the API's rule above, not the packages.
