# Jinion

A coding agent for your terminal. [jinion.co](https://jinion.co)

Jinion runs Claude Code headless and brings its own terminal UI, system prompt and project instructions. A scripted demo (`--demo`) plays a full agent turn without a model behind it.

## Layout

```
apps/cli        @jinion/cli   the `jinion` command
packages/tui    @jinion/tui   terminal UI framework on top of Ink and React
```

Turborepo runs `build` and `typecheck` across the workspace. Packages export their TypeScript sources under the `development` condition, so `pnpm dev` and `pnpm typecheck` work without building first.

## Getting started

Requires Node 22+, pnpm, and a Claude Code login (`claude` → `/login`); Jinion uses that login.

```sh
pnpm install
pnpm dev                 # run from source, on this repo
pnpm dev --demo          # the scripted demo
pnpm build && pnpm start # run the compiled CLI
pnpm typecheck
```

To use `jinion` in any project, build it once and link the command into a directory on your `PATH`:

```sh
pnpm build
ln -s "$PWD/apps/cli/bin/jinion.js" ~/.local/bin/jinion
cd ~/code/my-project && jinion
```

The command runs the compiled CLI, so run `pnpm build` again after changing Jinion.

`/model` switches the model and its effort from a list the agent provides, here the models your Claude account can use. `/model sonnet` and `/effort high` switch directly. The pick applies to the running conversation from the next request, and later runs start with it. `jinion --model <alias|id>` and `--effort <level>` (or `JINION_MODEL`, `JINION_EFFORT`) override it for one run; without any choice it's `opus` at the model's default effort.

`jinion --theme light|dark` (or `JINION_THEME`) skips terminal background detection.

In the demo, try `hello`, or `add rate limiting to the api` for the full tour.

### Conversations

Every conversation is saved after each turn, per project, and `/resume` lists them. `jinion -c` (`--continue`) opens the last one. Resuming continues the Claude Code session too, so the agent remembers it.

Jinion keeps its data in `~/.jinion` (or `$JINION_HOME`): `settings.json` for the last model and account picked per agent and the status line, `limits.json` for the plan limits last seen per account, `accounts/` for the extra logins, and one folder per project with `sessions/*.json`, `permissions.json` and `settings.json` (its mode).

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

Claude Code's own settings, CLAUDE.md files, memory, MCP servers and claude.ai connectors are not loaded. Jinion writes the system prompt and adds the project's `AGENTS.md` and `CLAUDE.md` to it.

| Key | Action |
| --- | --- |
| `enter` | Send |
| `shift+enter`, `alt+enter`, trailing `\` | New line |
| `up` / `down` | Prompt history |
| `esc` | Interrupt the running turn |
| `ctrl+o` | Expand or collapse long output and pasted text |
| paste | Text of two lines or more, or 800 characters, goes in as `[Pasted text #1 +42 lines]`; the agent gets all of it |
| `/` | Command palette: built-in commands, skills and MCP prompts, filtered as you type |
| `@` | Mentions a file or folder of the project, completed as you type; Claude Code reads it into the conversation, so the agent can work on it without opening it first |
| `ctrl+c` | Interrupt, close a panel, clear the prompt, or quit |
| mouse wheel, `pgup` / `pgdn` | Scroll the conversation; click `Jump to bottom` to follow again |
| `shift` + drag | Select text (`option` in iTerm2), since the app receives mouse events |

`@` completes the project's files and folders: what git tracks or could track, so ignored files stay out, with names that match ranking first. A folder goes in without a space, so typing on lists what's inside.

The prompt grows to 20 lines, then scrolls inside, with the rules above and below saying how many lines are out of view. A paste placeholder acts as one character: the cursor steps over it and backspace removes it whole.

When the agent asks a question, the prompt turns into the question panel: `up`/`down` move, `enter` picks, `n` attaches a note to the highlighted option, "Other" takes a free-text answer and `esc` cancels the turn. A question that takes several answers shows `[x]` boxes: `space` checks options and `enter` sends them.

| Command | Does |
| --- | --- |
| `/help [tab]` | Shortcuts, then one tab per command source |
| `/resume [search]` | Full screen, searchable list of this project's saved conversations; the agent picks up where it left off |
| `/clear` (`/new`) | Saves this conversation and starts a new one |
| `/model [model]` | Picks the model and effort (up/down for the model, left/right for the effort), or switches straight to `model` |
| `/effort [level]` | Opens the same picker, or sets the effort straight away; `default` leaves it to the model |
| `/account [name \| add <name>]` | Switches to another login, or signs a new one in |
| `/mode [mode]` | Picks the mode (manual, edits, plan, auto), as `shift+tab` does |
| `/statusline` | Chooses what the status line shows: space shows or hides, left/right picks a style, tab switches sides, shift+up/down moves, `r` resets; the line below previews it, enter saves |
| `/expand` | Same as `ctrl+o` |
| `/exit` (`/quit`) | Quits |

The demo agent also offers skills (`/review`, `/commit`, `/explain <path>`) and MCP prompts (`/github:pr-summary <number>`, `/linear:create-issue`). In the palette, Tab completes and Enter runs; commands with a required `<argument>` are inserted instead so you can type it.

## How the CLI is wired

- `agent/types.ts` defines the `Agent` interface: the `AgentEvent` stream every agent emits, the commands (skills, MCP prompts) it offers, and its models. An agent names itself (`Claude`), lists the models with their effort levels (`models()`), and switches between them (`select()`). The model picker, `/model`, `/effort`, the status line and the saved choice all work from that, so another backend such as Codex only implements those methods. `ScriptedAgent` plays `agent/scenarios.ts` through it.
- `agent/claude/` implements it on the Claude Agent SDK. `agent.ts` keeps one Claude Code process per conversation and sets the tools and permissions, `events.ts` maps SDK messages to `AgentEvent`s (Claude Code's task tools become the todo list), and `prompt.ts` builds the system prompt.
- `context.ts` is the app's single control surface. `useJinion()` gives commands, panels and key handlers the same `actions` (submit, prompt, fill, notice, newSession, resume, …), the panel stack, the command registry and the session store.
- `commands/` holds the `CommandRegistry`. Built-in commands live in `builtin.tsx`; agent commands are mapped in by `agentCommands()`. The registry also provides the palette's completion source and the help tabs, so a new command shows up everywhere at once.
- `panels/` holds the panels commands open (`HelpPanel` at the bottom, `ResumePanel` full screen), built from `@jinion/tui`'s `Panel`.
- `session.ts` reduces events into conversation entries; `session-store.ts` defines `SessionStore`. `FileSessionStore` keeps each conversation as a JSON file, together with the agent's own session id that `Agent.reset(resume)` takes to continue it. The demo uses an in-memory store with sample conversations.
- `ui/entry.tsx` maps entries to `@jinion/tui` components. `shortcuts.ts` is the list `/help` shows.

See [packages/tui/README.md](packages/tui/README.md) for the framework itself.
