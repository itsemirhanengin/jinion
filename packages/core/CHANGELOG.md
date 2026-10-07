# @jinion/core

## 0.0.9

### Patch Changes

- b12cc63: Plans of their own. A plan opens by itself beside its thread, a third of the window, as a document you can change before
  you answer: headings, marks over a selection, lists and task lists, code, tables, and Mermaid diagrams, drawn, and
  edited in a window of their own with the drawing following the text. A bar over the plan says where it stands and
  answers it, Keep planning or Build in a mode, as the panel under the conversation does. A plan you changed goes to the
  agent with a line saying you changed it, so it builds your version. The conversation shows a plan as one row that opens
  it, diagrams are drawn there too, Esc in the plan leaves the turn running, and the agent is asked to write plans as a
  short document with a diagram, steps, the files and the risks. The demo agent plans when asked to.

## 0.0.8

### Patch Changes

- 86213a0: A command the agent runs in a terminal gives a prompt again once it ends, ctrl+c included, as a terminal does, and its
  terminal keeps how it ended. A long command's name fades out in the terminal list rather than pushing its status past
  the edge.

## 0.0.7

### Patch Changes

- 417f83d: Terminals in the bottom panel, which belong to the project, so they stay open from one thread to the next. A terminal
  opens at once when the panel shows none, can be split into panes side by side, and is listed on the right with the
  panes of a split together; the right panel has Terminal beside Changes. The agent reads the terminals and starts what
  keeps running, such as a dev server, in one of them, asked about as a command is; the panel opens on it. Prompts drawn
  with powerline arrows show as they do in other terminals, and stay readable on the light theme. Tasks shows only when a
  thread has some. The core gets `terminals/*` methods and notifications, an addition that keeps `PROTOCOL_VERSION`.

## 0.0.6

### Patch Changes

- ce193fb: The composer does what the terminal's does: `/` lists the commands and the skills, `$` the skills, `@` the project's
  files, over the composer or under the line being typed when there is no room above. Images go in by pasting, dropping
  or the attach button, at the caret, under their file name, so a message can say which image it means; a click opens
  one large. Files after `@` and skills after `$` show as pills in soft blue and violet. Menus, lists and tooltips are lighter: one line a row, the description faint beside the name. While a turn
  runs, Tab queues a message, and a queued one can be taken back to edit or removed
  (`session/unqueue`). A command's view opens where the window has it: `/model` and `/mode` their menus, `/context` what
  fills the context, `/diff` the Git tab, `/memory`, `/usage` and `/account` their pages, `/tasks` the bottom panel.

## 0.0.5

### Patch Changes

- 54b3f00: A profile page in place of Accounts.
  
  - Your name and email, then what you have done with Claude and Codex together: lifetime tokens, the peak day, active
    days and your streaks, a year of token activity by day, week or in total, your top models and a few insights.
  - Every account of every backend in one list, the ones in use marked; a row's menu uses it, signs in again or removes
    it, and Connect an account adds one.
  - The heatmap's squares say their day and tokens in a tooltip that moves along with the pointer.
  - Jinion's own icon, in place of Electron's.

## 0.0.4

### Patch Changes

- 8f3d5aa: A git panel to stage and commit, and a thread's changes in a tab of their own.
  
  - Git, under Search, opens a sidebar with a commit box, Stage All and Commit (⌘↵), and the changed files with a
    checkbox to stage each; beside it a tab shows every changed file's diff, one under another, and a file clicked in the
    sidebar scrolls there.
  - A folder holding several repositories shows each one as its own group, with its branch and commit box.
  - Changes, in the right panel, opens a tab with every file the thread changed, for the whole thread or one turn.
  - The right panel keeps Changes and Tasks; Files stays in the activity bar.

## 0.0.3

### Patch Changes

- 5bb5b0b: The projects screen shows each project's sessions, and the title bar opens projects without leaving where you are.
  
  - The projects screen lists your projects on the left and the picked one's sessions on the right, with a search; a
    session opens in its project's tab, and New session starts one there.
  - The `+` in the title bar opens a menu of recent and other projects, with a search and Open folder, instead of going
    to the projects screen.
  - A button at the left of the title bar goes back to the projects screen.
  - Calm empty states when there are no projects, no sessions in a project, or no matches.
  - Tabs keep one width: a long title fades out at its end, the close button shows on hover, and always on the shown tab.

## 0.0.2

### Patch Changes

- 8b6ce2e: The core starts from `@jinion/core/host`, takes clients over a message channel (`portTransport`), and reads a file in a
  session's folder with `files/read`, all for the desktop app. The CLI works as before.
