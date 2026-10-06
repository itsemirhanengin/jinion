# @jinion/core

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
