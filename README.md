# Jinion

A coding agent for your terminal. [jinion.co](https://jinion.co)

Jinion runs Claude Code headless and brings its own terminal UI, system prompt and project instructions. A scripted demo (`--demo`) plays a full agent turn without a model behind it.

## Layout

```
apps/cli                 @jinion/cli              the `jinion` command
packages/tui             @jinion/tui              terminal UI framework on top of Ink and React
packages/virtualization  @jinion/virtualization   mounts only what is in view of a long list, for the TUI's ScrollView
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

A conversation is titled after what it is about, so you can find it in `/resume`: after the first turn, Haiku names it from your messages, without thinking and in a request of its own beside the conversation. It names it again as the conversation moves on (each time the messages double, after twenty minutes with new ones, and once a plan is accepted), keeping the title while it still fits. `/rename <name>` gives it a name of yours, which stays; `/rename` alone has it named from what it is about now, and again as it moves on.

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

In the panel, `l` signs the highlighted account in again, e.g. when its login expired or should be another one; for the account in use, the conversation carries on with the new login after the turn. `d` twice signs an account out through `claude auth logout` and removes its folder; its conversations stay, since they are shared. The `default` account is Claude Code's own login, so it can sign in again but stays, and the account in use is removed after switching to another. `/account add <name>` and `/account remove <name>` do the same from the prompt.

### Status line

`/statusline` picks from these, in any order, on either side:

| Segment | Shows | Styles |
| --- | --- | --- |
| Jinion | `jinion` | |
| Model | `[M] Opus 5.5 · high` | with effort, name only |
| Mode | `Auto`, also always under the prompt | |
| Account | `[A] work` | |
| Directory | `[D] experiments/coding-agent` | last two folders, full path, folder name |
| Git | `[G] main *3 ↑1`; `[G] 4 repos *7` in a folder that holds several | with uncommitted files and commits ahead/behind, branch only |
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

In every mode, Jinion itself asks before a commit and before a file outside the project changes, without a "don't ask again" choice: through the file tools, and through commands, by what they write to (`>`, `>>`, `tee`), change (`rm`, `mv`, `touch`, `chmod`, `sed -i`, `dd of=`) or copy to (`cp`, `ln`), also after a `cd`. Temporary folders such as `/tmp` and streams such as `/dev/null` don't count, and neither does a path behind a variable other than `$HOME`, which only the shell can tell. These checks run as a hook ahead of Claude Code's own (`apps/cli/src/agent/claude/guard.ts`). A command asked about shows that it waits for your approval, and its time runs from when you allowed it.

### Permissions

File edits inside the project, read-only tools, web fetch and search, and a few commands (`git status/diff/log/show/branch`, also as `git -C <folder> …` in a folder of several repositories, `ls`, `pnpm`/`npm` scripts) run without asking in Accept edits. Anything that needs asking opens the permission panel in place of the prompt:

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
| `esc` `esc` | Between turns: rewind to before an earlier message (`/rewind`); with something typed, clear it first, keeping it in the history for `up` |
| `ctrl+o` | Expand or collapse long output and pasted text |
| `ctrl+t` | Background tasks: what runs there, its latest output, `x` to stop one (`/tasks`) |
| `ctrl+b` | While a command or subagent has run a few seconds, send it to the background; the turn goes on without it |
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

`esc` twice (or `/rewind`) goes back to before an earlier message, the way Claude Code does. The panel lists the messages you sent, newest first, leaving out ones that joined a running turn, and under the highlighted one what going back would change in files (`2 files change +24 -7`, and which). Then it asks what to take back; the two that restore code show only where there are file changes:

| Choice | Does |
| --- | --- |
| Restore code and conversation | Files go back to how they were before the message, the conversation goes on from before it, and the message returns to the prompt to edit and send again |
| Restore conversation | The same, but the files stay as they are |
| Restore code | Files go back; the conversation goes on as it is |
| Never mind | Back to the messages |

Files come back from Claude Code's checkpoints, which it takes before each change and keeps across processes, so a resumed conversation can still be rewound. The conversation continues in a new Claude Code process from the transcript entry before the message. As in Claude Code, only what the file tools changed comes back: changes made by commands stay, and so do Jinion's memory notes, which belong to no single conversation.

The prompt stays open while the agent works. A message sent then steers the turn: it shows in the conversation marked `while working`, and Claude reads it as soon as its current tool calls finish, or answers it right after when the turn was ending anyway. `ctrl+q` queues a message instead: it waits above the prompt as `queued: …` and goes out as its own turn when this one is done, in order with the others. When the turn is interrupted or fails, queued messages come back into the prompt. An agent that can't take messages into a turn, like the demo, queues them all.

Commands that keep running, like a dev server or a long test run, and subagents can go on in the background while the conversation goes on: the agent starts them there, or `ctrl+b` sends the one the turn waits for (the line under the prompt offers it once Claude Code lists the command, after a few seconds). While something runs there, a line above the prompt says what and for how long, `bg [/] pnpm dev 3m · ctrl+t`. `ctrl+t` (or `/tasks`) opens the panel: every task of the conversation with how it ended, the focused one's latest output under it, `enter` for the whole output full screen, following its end, and `x` to stop it. `esc` stops the turn and leaves background tasks running.

When a task ends, the conversation says so (`[!] Background pnpm test · failed after 41s · exit 1`), and the agent looks at it in a turn of its own, the way Claude Code does: it shows as working, panels ask as in any turn, `esc` stops it, and messages typed meanwhile wait for it. A task that ends while the window isn't focused notifies. Tasks belong to the Claude Code process, so they stop with `/clear`, `/resume`, an account switch or quitting; MCP changes wait to restart Claude Code until none runs.

Long conversations are compacted the way Claude Code does it: `/compact` summarizes the conversation so far, keeping what you name above all (`/compact the API changes`), and Claude Code compacts on its own as the context fills. While it runs, the line under the prompt says so; then the conversation marks where, with how much context it took down (`[x] Compacted · 160.2k → 21.4k tokens`), and `ctrl+o` shows the summary the agent carries on from. Once a fifth or less of the context is left before auto-compaction, the rule under the prompt says how much (`12% context left until auto-compact · /compact`). `/context` shows what fills the window as Claude Code's grid of squares, a square per percent, by kind: the system prompt, tools, skills, messages, the free space and what compaction keeps in reserve, and what is listed by name but loads only when used, such as MCP tools.

`/usage` shows where the plan's limits stand, the 5-hour window and the week, per model where the plan has one, with when each resets; this session's cost and tokens by model; and what adds to the limits over the last day or week (`d`/`w`), from this machine's conversations: traits such as subagent-heavy or long-context sessions, and the skills, subagents and MCP servers that used the most. `tab` switches to the stats: a calendar of every day of use, a square per day shaded by how many responses it had, like GitHub's contribution graph; the arrows pick a day to see its numbers, and `r` switches between all time, the last 30 days and the last 7 for the sessions, active days, streaks, busiest day, longest session and each model's share of the tokens.

The stats come from Claude Code's transcripts on this machine, every login's, so they cover Claude Code used outside Jinion too. Each response counts once (Claude Code writes a line per block of a response), subagents included. What was read is kept in `~/.jinion/usage/claude.json`, so a later look only reads what was added, and days stay after Claude Code deletes their transcripts a month on. Days no transcript has come from Claude Code's own summary (`stats-cache.json`), scaled to how it compares with the transcripts on the days both cover, since it counts messages and tokens its own way; their tokens show as a total.

When the agent hands part of the work to a subagent, its tool calls grow as a tree under `Agent · what it is doing`, one line each, the latest six in view; the line under the prompt says what the subagent is on. Once it is done, the tree folds into `6 tool calls · 34s`, and `ctrl+o` opens it again.

`/diff` works as in Claude Code. Its Current view shows what isn't committed, staged or not, new files included, with `+`/`-` lines per file, or, when nothing is, what the branch adds on top of the default branch. Files the agent changed in this conversation, subagents included, are marked `agent`, so they stand apart from your own edits. `left`/`right` go through the turns in which the agent changed files, newest first, each showing just that turn's edits; these come from the agent's edits rather than git, so a change made by a command shows only under Current. `enter` opens a file's diff, scrolled with `up`/`down` and `pgup`/`pgdn`, and `esc` goes back to the list. To take changes back, rewind (`esc` `esc`).

Jinion also works in a folder that isn't a repository but holds several, such as a parent folder of four repositories opened for the context across them. It finds the repositories up to three folders down (skipping `node_modules`, build output and hidden folders), and:

- `/diff` groups the changes under each repository with its branch, and shows what a branch adds for each repository with nothing uncommitted;
- the status line's Git segment sums them up, as `4 repos *7`;
- the system prompt lists the repositories and their branches, and tells the agent to run git in the one a change belongs to (`git -C api status`).

While the terminal window isn't focused, Jinion notifies when it waits for you (a question, a permission or a plan to review) and when a turn of 15 seconds or more ends, with what it is about: `jinion · api: Done with “add rate limiting” after 1m 12s.` The notification is the terminal's own: OSC 777 in Ghostty, WezTerm, Warp, foot and rxvt, OSC 9 in iTerm2, OSC 99 in kitty, and the bell elsewhere and inside tmux or screen. The terminal reports focus changes (mode 1004), so nothing pops up while you watch. `/notifications` turns them off or on again.

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
| `/account [name \| add <name> \| remove <name>]` | Switches to another login, signs one in (again), or signs one out and removes it |
| `/mcp` | Lists the MCP servers with their state and tools; `space` turns them on or off, `enter` saves |
| `/mode [mode]` | Picks the mode (manual, edits, plan, auto), as `shift+tab` does |
| `/diff` | Full screen list of what isn't committed, in every repository here, with the agent's changes marked; `left`/`right` for each turn's edits, `enter` opens a file's diff |
| `/rename [name]` | Names the conversation, to find it in `/resume`; without a name, Haiku names it from what it is about |
| `/rewind` | Goes back to before an earlier message: code, conversation or both, as `esc` `esc` does |
| `/tasks` | What runs in the background, its output, and `x` to stop it, as `ctrl+t` does |
| `/compact [focus]` | Summarizes the conversation so far to free context, keeping what `focus` says above all |
| `/context` | What fills the context window, a square per percent, and where the agent compacts on its own |
| `/usage` | Full screen: the plan's limits, this session, and what adds to the limits; `tab` for the stats |
| `/stats` | The same panel on its stats: every day of use as a calendar, with streaks and models |
| `/notifications [on \| off]` | Turns notifications on or off, for every project; without an argument, switches them |
| `/statusline` | Chooses what the status line shows: space shows or hides, left/right picks a style, tab switches sides, shift+up/down moves, `r` resets; the line below previews it, enter saves |
| `/expand` | Same as `ctrl+o` |
| `/exit` (`/quit`) | Quits |

The demo agent also offers skills (`$review`, `$commit`, `$explain <path>`) and MCP prompts (`$pr-summary <number>`, `$create-issue`). In the palette, Tab completes and Enter runs; commands with a required `<argument>` are inserted instead so you can type it.

## How the CLI is wired

- `agent/types.ts` defines the `Agent` interface: the `AgentEvent` stream every agent emits in a turn (`run()`) and between turns (`subscribe()`), the commands (skills, MCP prompts) it offers, its MCP servers (`mcp`), and its models. An agent names itself (`Claude`), lists the models with their effort levels (`models()`), and switches between them (`select()`). The model picker, `/model`, `/effort`, the status line and the saved choice all work from that, so another backend such as Codex only implements those methods. `ScriptedAgent` plays `agent/scenarios.ts` through it.
- `agent/claude/` implements it on the Claude Agent SDK:
  - `agent.ts` is the `Agent`: models, modes, accounts, MCP servers and commands, and which process runs the conversation.
  - `process.ts` is one Claude Code process. It reads everything Claude Code sends for as long as it runs: what answers a prompt goes to that turn, the rest to `subscribe()`, e.g. the commands changing as MCP servers connect. A turn Claude Code starts itself, e.g. after a background task ended, is announced with `turn-start`, and `Agent.join` follows it like a prompted one. A process that exits fails its turn with what Claude Code printed, and the next prompt continues the conversation in a new one.
  - `options.ts` is how Claude Code starts: tools, permission rules, system prompt, skills and MCP servers. `approvals.ts` answers what Claude Code asks before a tool runs: the guard, questions, plans and permissions.
  - `events.ts` maps SDK messages to `AgentEvent`s (Claude Code's task tools become the todo list, and `tasks.ts` follows its background tasks), `commands.ts` maps skills and `$` mentions, `mcp.ts` servers, `plugins.ts` hands over skills and plugins, and `prompt.ts` builds the system prompt.
  - Tests start a stand-in for Claude Code (`test/fake-claude.ts`) through the agent's `spawn` option, to script what it sends back.
- `mcp/config.ts` reads the MCP servers configured in files, and which are on, for any backend.
- `context.ts` is the app's single control surface. `useJinion()` gives commands, panels and key handlers the same `actions` (submit, prompt, fill, notice, newSession, resume, …), the panel stack, the command registry and the session store.
- `commands/` holds the `CommandRegistry` of Jinion's own commands, which live in `builtin.tsx`. The registry also provides the palette's completion source and the help tab, so a new command shows up everywhere at once.
- `skills.ts` completes and highlights the agent's skills and MCP prompts (`Agent.commands()`) as `$` mentions; the agent turns the mentions into what its backend runs.
- `panels/` holds the panels commands open (`HelpPanel` at the bottom, `ResumePanel` full screen), built from `@jinion/tui`'s `Panel`.
- `usage/` turns the agent's history into the stats `/usage` shows (`stats.ts`) and formats its figures; `agent/claude/usage.ts` maps Claude Code's experimental usage call, and `agent/claude/history.ts` reads its transcripts.
- `git/repos.ts` finds the repositories a project works in (its own, or those in its folders) and reads their state and changes, for `/diff`, the status line and the system prompt.
- `session.ts` reduces events into conversation entries; `session-store.ts` defines `SessionStore`. `FileSessionStore` keeps each conversation as a JSON file, together with the agent's own session id that `Agent.reset(resume)` takes to continue it. The demo uses an in-memory store with sample conversations.
- `ui/entry.tsx` maps entries to `@jinion/tui` components. `shortcuts.ts` is the list `/help` shows.

See [packages/tui/README.md](packages/tui/README.md) for the framework itself.
