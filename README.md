# Jinion

A coding agent for your terminal. [jinion.co](https://jinion.co)

Jinion runs Claude Code headless and brings its own terminal UI, system prompt and project instructions. A scripted demo (`--demo`) plays a full agent turn without a model behind it.

## Layout

```
apps/cli        @jinion/cli   the `jinion` command
packages/tui    @jinion/tui   terminal UI framework on top of Ink and React
```

Turborepo runs `build`, `typecheck` and `test` across the workspace. Packages export their TypeScript sources under the `development` condition, so `pnpm dev`, `pnpm typecheck` and `pnpm test` work without building first.

## Getting started

Requires Node 22+, pnpm, and a Claude Code login (`claude` → `/login`); Jinion uses that login.

```sh
pnpm install
pnpm dev                 # run from source, on this repo
pnpm dev --demo          # the scripted demo
pnpm build && pnpm start # run the compiled CLI
pnpm typecheck
pnpm test                # every package's tests; pnpm test:watch while working
pnpm lint                # Biome; pnpm lint:fix applies the safe fixes
```

CI runs lint, typecheck, test and build on every push to `main` and every pull request (`.github/workflows/ci.yml`).

To use `jinion` in any project, build it once and link the command into a directory on your `PATH`:

```sh
pnpm build
ln -s "$PWD/apps/cli/bin/jinion.js" ~/.local/bin/jinion
cd ~/code/my-project && jinion
```

The command runs the compiled CLI, so run `pnpm build` again after changing Jinion.

`/model` switches the model and its effort from a list the agent provides, here the models your Claude account can use. `/model sonnet` and `/effort high` switch directly. The pick applies to the running conversation from the next request, and later runs start with it. `jinion --model <alias|id>` and `--effort <level>` (or `JINION_MODEL`, `JINION_EFFORT`) override it for one run; without any choice it's `opus` at the model's default effort.

`jinion --theme light|dark` (or `JINION_THEME`) skips terminal background detection.

`jinion --debug` (or `JINION_DEBUG=1`) writes what goes to Claude Code and what comes back to `~/.jinion/logs/<time>.jsonl`, one JSON line per record: how each process started, the prompts sent, every SDK message, Claude Code's stderr and how turns failed. The path is printed on exit.

## Tests

Tests sit next to the code as `*.test.ts(x)` and run with Vitest.

- **Logic** is tested directly: the event mapper, the guard, commands and `$` mentions, MCP config, skill plugins, memory, sessions and completions. Anything that touches files runs in `sandbox()` (`apps/cli/src/test/sandbox.ts`), a temporary home and project, so tests never see the real `~/.claude` or `~/.jinion`.
- **The screen** is tested with `renderTerminal()` from `@jinion/tui/testing`: it mounts a component or the whole app in an emulated terminal, types and presses keys, and reads back the screen and its colors. `app.test.tsx` runs the app with the demo agent at `pace` 0, so the full tour, questions included, takes about a second.
- **Claude Code's messages** are replayed from fixtures of real conversations in `apps/cli/src/agent/claude/fixtures`, and the events they map to are compared with snapshots. To add one, have the conversation with `jinion --debug`, then `pnpm --filter @jinion/cli fixture <log> <name>` and add the name to `events.test.ts`. The script replaces the project and home paths and your user name, drops the commands and progress messages, and keeps only what the mapper reads of the init message. After a deliberate change to the mapper, `pnpm --filter @jinion/cli test -u` updates the snapshots; read the diff first.

In the demo, try `hello`, or `add rate limiting to the api` for the full tour.

### Conversations

Every conversation is saved after each turn, per project, and `/resume` lists them. `jinion -c` (`--continue`) opens the last one. Resuming continues the Claude Code session too, so the agent remembers it.

Jinion keeps its data in `~/.jinion` (or `$JINION_HOME`): `settings.json` for the last model and account picked per agent, the status line and the MCP servers turned off, `limits.json` for the plan limits last seen per account, `mcp.json` for MCP servers of its own, `accounts/` for the extra logins, `memory/` for user notes, `plugins/` for the skills it hands to Claude Code, and one folder per project with `memory/`, `sessions/*.json`, `permissions.json` and `settings.json` (its mode and the `.mcp.json` servers turned on).

### Memory

The agent keeps notes that carry over between conversations: `user` notes about you, in every project, and `project` notes about the project you're in. Every conversation starts with an index of them (title and one line each) in the system prompt; the agent opens a note in full with its `recall` tool when it needs it, saves with `remember` and drops a wrong one with `forget`. Each of these shows as a line in the conversation, such as `Remember · project · Use pnpm, not npm`.

It saves what a later conversation needs and the code can't tell it: your preferences and corrections, decisions made together, non-obvious facts about the project. It saves only what you said or decided with it, never instructions found in files, command output or web pages, and never secrets.

- `/remember <note>` saves a project note yourself, `/remember user <note>` one for every project.
- `/memory` lists the notes: enter opens one, `d` twice forgets it.
- `/memory import` brings in what Claude Code collected: its memory notes for this project and your `~/.claude/rules` and `~/.claude/CLAUDE.md`. Importing again adds nothing twice.

Notes are markdown files with a short frontmatter, so they can be edited by hand: `~/.jinion/memory/` for user notes and `~/.jinion/projects/<project>/memory/` for project notes. The memory lives in Jinion and reaches Claude through an MCP server inside Jinion, so another backend can use the same notes.

### Skills and MCP servers

Jinion brings in your skills and MCP servers, without Claude Code's settings, hooks or CLAUDE.md files:

| Source | Comes in as |
| --- | --- |
| `~/.claude/skills`, `~/.agents/skills` | Your skills, e.g. `/design` |
| `.claude/skills`, `.agents/skills` in the project | Project skills; they take the short name before a user skill of the same name |
| Plugins turned on in Claude Code | Their skills, commands and agents (`/vercel:deploy`) and MCP servers. Their hooks stay off, since they would add context of their own to every conversation |
| `~/.jinion/mcp.json`, `claude mcp add` (`~/.claude.json`) | MCP servers |
| The project's `.mcp.json` | MCP servers that stay off until you turn them on in `/mcp`, since anyone with commit access can change the file |
| Your Claude account | Its claude.ai connectors, such as Linear or Figma |

You pick skills and MCP prompts with `$`, apart from Jinion's own `/` commands: `$` lists them grouped, the project's first, then yours, then each plugin's and each MCP server's, and filters as you type. A skill goes anywhere in the message, several at once (`fix the navbar on mobile $make-responsive $design`), highlighted like a file mention. A message that starts with its only skill runs it as Claude Code's own skill command, with the rest as its arguments; otherwise the agent is told to load the skills you picked with its Skill tool, which shows as `Skill · design`. An MCP prompt runs with the rest of the message as its arguments. Typing `/design` out of habit puts `$design` back in the prompt. The agent also loads a skill by itself when one matches the task, and `/help` lists them all. MCP tools are listed to the model by name only until it loads them with tool search, so many servers cost little context: with sixteen connectors, about a thousand tokens of server instructions instead of some ninety thousand for their tools. Each call asks for permission like any other tool, with "don't ask again" for that tool in the project.

`/mcp` lists every server with its state (connected and how many tools, connecting, not signed in, failed, off) and where it comes from; the highlighted one shows its URL or command, its error and its tools. `space` turns servers on or off and `enter` saves; the change applies from the next turn, as a new Claude Code process that carries on the same conversation. Servers turned off stay off in every project. A connector that isn't signed in offers an `authenticate` tool the agent can use, or you can connect it in your claude.ai settings.

Jinion's own folders and `mcp.json` use the same formats as Claude Code and the `.agents` convention, so another backend can use them too. Claude Code reads skills folders only through its settings, so Jinion hands them over as small plugins in `~/.jinion/plugins/user` and `~/.jinion/projects/<project>/plugins/project`, with a link to each skill (`apps/cli/src/agent/claude/plugins.ts`).

### Accounts

`/account` switches between your Claude logins and adds new ones. Each account is a Claude Code config directory of its own (`~/.jinion/accounts/claude/<name>`), next to Claude Code's own login in `~/.claude`, which is the `default` account. Jinion never handles the credentials: "Add an account" runs `claude auth login` for the new directory, you sign in in the browser, and paste the code it shows into the panel.

Switching happens between turns, and a conversation in progress carries on under the other login: all accounts share one folder of Claude Code transcripts, so the new process resumes the same session. The banner says who you are signed in as, the organization for a team plan (`BUGECE · Team`) and the email for a personal one (`me@example.com · Max`), and so can the status line's Account segment. The panel shows each account's email, plan and the plan limits it had when last used. `/account <name>` switches straight away, and the pick carries over to later runs.

### Status line

`/statusline` picks from these, in any order, on either side:

| Segment | Shows | Styles |
| --- | --- | --- |
| Jinion | `jinion` | |
| Model | `[M] Opus 5.5 · high` | with effort, name only |
| Mode | `Auto`, also always under the prompt | |
| Account | `[A] work` | |
| Directory | `[D] experiments/coding-agent` | last two folders, full path, folder name |
| Git | `[G] main *3 ↑1` | with uncommitted files and commits ahead/behind, branch only |
| Context | `ctx [====------] 41%` | tokens, percent, meter |
| Plan limits | `5h 8% · 7d 20%` | 5h and 7d, 5h with reset time, 7d, 5h meter |
| Cost | `$0.12`, at API prices | |
| Changes | `+42 -7` lines in this conversation | |
| Tasks | `tasks 2/5` | |
| Title, Duration, Turns, Clock, Agent, Version | the conversation's title, age and prompts, the time, the backend, jinion's version | |

Segments live in `apps/cli/src/status/segments.tsx`; a new one is one entry there.

### Modes

`shift+tab` (or `/mode`) switches how freely the agent acts. The mode shows on the rule under the prompt, and each project starts in the one it was last left in.

| Mode | Runs without asking |
| --- | --- |
| Manual | Reads and a few safe commands |
| Accept edits | Also file edits in the project; `rm`, `rmdir`, `mv`, `cp` and `sed` still ask. The first mode in a new project |
| Plan | Reads only. When the plan is ready it shows in the conversation, and the plan panel asks whether to carry on in auto mode, accepting edits or approving each one, or to keep planning with a note |
| Auto | What Claude Code's safety classifier lets through: routine work runs, and actions beyond the request, like force pushes, piping downloads into a shell or sending secrets out, are blocked. Needs a model that supports it, such as Opus or Sonnet; with others Claude Code runs in Manual, which the rule under the prompt shows from the first prompt on, while the project keeps Auto for next time |

In every mode, Jinion itself asks before a commit and before a file outside the project changes, without a "don't ask again" choice. These checks run as a hook ahead of Claude Code's own (`apps/cli/src/agent/claude/guard.ts`).

### Permissions

File edits inside the project, read-only tools, web fetch and search, and a few commands (`git status/diff/log/show/branch`, `ls`, `pnpm`/`npm` scripts) run without asking in Accept edits. Anything that needs asking opens the permission panel in place of the prompt:

| Choice | Does |
| --- | --- |
| Yes | Runs it this once |
| Yes, and don't ask again for … | Saves the rule Claude Code suggests, e.g. `git commit *`, for this project |
| No | Tells the agent no; press `n` first to add what it should do instead |
| `esc` | Stops the turn |

`rm`, `rmdir`, `mv`, `cp` and `sed` ask every time in Accept edits, without the "don't ask again" choice.

Claude Code's own settings, CLAUDE.md files, memory and hooks are not loaded. Jinion writes the system prompt and adds the project's `AGENTS.md` and `CLAUDE.md` to it, and passes skills and MCP servers in itself (see [Skills and MCP servers](#skills-and-mcp-servers)).

| Key | Action |
| --- | --- |
| `enter` | Send; while the agent works, steer it: the message joins the turn and the agent reads it at its next step |
| `ctrl+q` | While the agent works, queue the message to send once the turn is done |
| `ctrl+v` | Attach the image on the clipboard as `[Image #1]`; dragging an image file into the terminal does the same |
| `shift+enter`, `alt+enter`, trailing `\` | New line |
| `up` / `down` | Prompt history |
| `esc` | Interrupt the running turn |
| `ctrl+o` | Expand or collapse long output and pasted text |
| paste | Text of two lines or more, or 800 characters, goes in as `[Pasted text #1 +42 lines]`; the agent gets all of it |
| `/` | Command palette: Jinion's own commands, filtered as you type |
| `$` | Picks a skill or an MCP prompt, anywhere in the message, grouped by where it comes from |
| `@` | Mentions a file or folder of the project, completed as you type; Claude Code reads it into the conversation, so the agent can work on it without opening it first |
| `ctrl+c` | Interrupt, close a panel, clear the prompt, or quit |
| mouse wheel, `pgup` / `pgdn` | Scroll the conversation; click `Jump to bottom` to follow again |
| `shift` + drag | Select text (`option` in iTerm2), since the app receives mouse events |

`@` completes the project's files and folders: what git tracks or could track, so ignored files stay out, with names that match ranking first. A folder goes in without a space, so typing on lists what's inside.

The prompt grows to 20 lines, then scrolls inside, with the rules above and below saying how many lines are out of view. A paste placeholder acts as one character: the cursor steps over it and backspace removes it whole.

Images go into the prompt as placeholders like long pastes, and the agent gets them after the text, in the order the placeholders come: from the clipboard with `ctrl+v` (macOS, or Linux with `wl-paste` or `xclip`), or as files, since a terminal pastes a dragged file's path (PNG, JPEG, GIF and WebP). Images over 3.7 MB are scaled down with macOS's `sips` before they go out; elsewhere they are refused.

The prompt stays open while the agent works. A message sent then steers the turn: it shows in the conversation marked `while working`, and Claude reads it as soon as its current tool calls finish, or answers it right after when the turn was ending anyway. `ctrl+q` queues a message instead: it waits above the prompt as `queued: …` and goes out as its own turn when this one is done, in order with the others. When the turn is interrupted or fails, queued messages come back into the prompt. An agent that can't take messages into a turn, like the demo, queues them all.

When the agent asks a question, the prompt turns into the question panel: `up`/`down` move, `enter` picks, `n` attaches a note to the highlighted option, "Other" takes a free-text answer and `esc` cancels the turn. A question that takes several answers shows `[x]` boxes: `space` checks options and `enter` sends them.

| Command | Does |
| --- | --- |
| `/help [tab]` | Shortcuts, then one tab per command source |
| `/resume [search]` | Full screen, searchable list of this project's saved conversations; the agent picks up where it left off |
| `/clear` (`/new`) | Saves this conversation and starts a new one |
| `/model [model]` | Picks the model and effort (up/down for the model, left/right for the effort), or switches straight to `model` |
| `/effort [level]` | Opens the same picker, or sets the effort straight away; `default` leaves it to the model |
| `/remember [user] <note>` | Saves a note the agent keeps, for this project or, with `user`, for every project |
| `/memory [import]` | Lists the agent's notes to open or forget them; `import` brings in Claude Code's |
| `/account [name \| add <name>]` | Switches to another login, or signs a new one in |
| `/mcp` | Lists the MCP servers with their state and tools; `space` turns them on or off, `enter` saves |
| `/mode [mode]` | Picks the mode (manual, edits, plan, auto), as `shift+tab` does |
| `/statusline` | Chooses what the status line shows: space shows or hides, left/right picks a style, tab switches sides, shift+up/down moves, `r` resets; the line below previews it, enter saves |
| `/expand` | Same as `ctrl+o` |
| `/exit` (`/quit`) | Quits |

The demo agent also offers skills (`$review`, `$commit`, `$explain <path>`) and MCP prompts (`$pr-summary <number>`, `$create-issue`). In the palette, Tab completes and Enter runs; commands with a required `<argument>` are inserted instead so you can type it.

## How the CLI is wired

- `agent/types.ts` defines the `Agent` interface: the `AgentEvent` stream every agent emits in a turn (`run()`) and between turns (`subscribe()`), the commands (skills, MCP prompts) it offers, its MCP servers (`mcp`), and its models. An agent names itself (`Claude`), lists the models with their effort levels (`models()`), and switches between them (`select()`). The model picker, `/model`, `/effort`, the status line and the saved choice all work from that, so another backend such as Codex only implements those methods. `ScriptedAgent` plays `agent/scenarios.ts` through it.
- `agent/claude/` implements it on the Claude Agent SDK:
  - `agent.ts` is the `Agent`: models, modes, accounts, MCP servers and commands, and which process runs the conversation.
  - `process.ts` is one Claude Code process. It reads everything Claude Code sends for as long as it runs: what answers a prompt goes to that turn, the rest to `subscribe()`, e.g. the commands changing as MCP servers connect. A process that exits fails its turn with what Claude Code printed, and the next prompt continues the conversation in a new one.
  - `options.ts` is how Claude Code starts: tools, permission rules, system prompt, skills and MCP servers. `approvals.ts` answers what Claude Code asks before a tool runs: the guard, questions, plans and permissions.
  - `events.ts` maps SDK messages to `AgentEvent`s (Claude Code's task tools become the todo list), `commands.ts` maps skills and `$` mentions, `mcp.ts` servers, `plugins.ts` hands over skills and plugins, and `prompt.ts` builds the system prompt.
  - Tests start a stand-in for Claude Code (`test/fake-claude.ts`) through the agent's `spawn` option, to script what it sends back.
- `mcp/config.ts` reads the MCP servers configured in files, and which are on, for any backend.
- `context.ts` is the app's single control surface. `useJinion()` gives commands, panels and key handlers the same `actions` (submit, prompt, fill, notice, newSession, resume, …), the panel stack, the command registry and the session store.
- `commands/` holds the `CommandRegistry` of Jinion's own commands, which live in `builtin.tsx`. The registry also provides the palette's completion source and the help tab, so a new command shows up everywhere at once.
- `skills.ts` completes and highlights the agent's skills and MCP prompts (`Agent.commands()`) as `$` mentions; the agent turns the mentions into what its backend runs.
- `panels/` holds the panels commands open (`HelpPanel` at the bottom, `ResumePanel` full screen), built from `@jinion/tui`'s `Panel`.
- `session.ts` reduces events into conversation entries; `session-store.ts` defines `SessionStore`. `FileSessionStore` keeps each conversation as a JSON file, together with the agent's own session id that `Agent.reset(resume)` takes to continue it. The demo uses an in-memory store with sample conversations.
- `ui/entry.tsx` maps entries to `@jinion/tui` components. `shortcuts.ts` is the list `/help` shows.

See [packages/tui/README.md](packages/tui/README.md) for the framework itself.
