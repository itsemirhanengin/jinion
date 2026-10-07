# @jinion/desktop

## 0.0.11

Plans of their own, read and changed before you answer.

- A plan opens by itself beside its thread, a third of the window, as a document you can change: headings, marks over a
  selection, lists and task lists, code and tables.
- Diagrams in a plan are drawn, and edited in a window of their own, the drawing following the text as you type.
- A bar over the plan answers it, Keep planning or Build in a mode, as the panel under the conversation does.
- A plan you changed goes to the agent with a line saying you changed it, so it builds your version.
- The conversation shows a plan as one row that opens it, and draws diagrams too.
- Plans come as a short document: the goal, a diagram where it helps, the steps, the files and the risks.
- Esc in a plan no longer stops the turn, and no "Working" shows while a plan waits for you.

## 0.0.10

Two fixes to the terminals.

- A command the agent runs in a terminal gives a prompt again once it ends, ctrl+c included, as any terminal does; the
  terminal still shows how the command ended.
- A long command's name fades out in the terminal list rather than pushing its status past the edge.

## 0.0.9

Terminals in the bottom panel, shared by every thread of the project.

- Terminal in the right panel opens one at once; + adds another, and ⌘\ splits the one you type in into panes side by
  side. The list beside them shows every terminal, a split's panes together.
- Terminals belong to the project, so a new thread or another one finds them as they were.
- The agent reads your terminals, and starts what keeps running, such as a dev server, in one of its own: the panel
  opens on it, with whether it runs or how it ended. It is asked about as any command is.
- Prompts with powerline arrows and icons show as in other terminals, and stay readable on the light theme.
- Tasks shows only when a thread has some.

## 0.0.8

Comments on a diff, sent to the agent as one message.

- In the Changes and Git tabs, the `+` beside a line's number comments on it; dragging it across the numbers comments
  on several.
- A comment stays under its lines, follows them as the file changes, and shows as outdated once they are gone.
- The comments wait in the composer as a pill and go with the next message, each with the lines it is on, or alone
  from the tab's Send; a click on the pill shows them where they were left.
- A queued message taken back to edit brings its comments back with it.

## 0.0.7

A composer that does what the terminal's does.

- `/` lists the commands and the skills, `$` the skills and `@` the project's files, over the composer or under the line
  you type when there is no room above.
- Files after `@` show as soft blue pills and skills after `$` as violet ones.
- Images go in by pasting, dropping or the attach button, at the caret under their file name, so a message can say
  which image it means; a click opens one large.
- While a turn runs, Tab queues a message, and a queued one can be taken back to edit or removed.
- A command opens what it shows where the window has it: `/model` and `/mode` their menus, `/context` what fills the
  context, `/diff` the Git tab, `/memory`, `/usage` and `/account` their pages, `/tasks` the bottom panel.
- Menus, lists and tooltips are lighter: one line a row, the description faint beside the name.

## 0.0.6

A profile page in place of Accounts.

- Your name and email, then what you have done with Claude and Codex together: lifetime tokens, the peak day, active
  days and your streaks, a year of token activity by day, week or in total, your top models and a few insights.
- Every account of every backend in one list, the ones in use marked; a row's menu uses it, signs in again or removes
  it, and Connect an account adds one.
- The heatmap's squares say their day and tokens in a tooltip that moves along with the pointer.
- Jinion's own icon, in place of Electron's.

## 0.0.5

A calmer conversation, and tabs that split and move by dragging.

- What the agent does between its words is one quiet list while it works, with a light passing over the step it is on,
  and folds into one line once done, such as `Worked for 27s · 2 files read, 1 command`.
- A file the agent read opens in a tab at the lines it read; a file named in its words, such as `files.ts:27`, opens
  on a click; an edit opens the thread's changes at that file.
- Text in the conversation can be selected, and the answer and code blocks copied.
- Your message shows its first lines and opens in full on a click, still on top.
- Scrolling up while the agent writes stays where you are; a button takes you back to the end.
- The todos and the agent's questions sit in the composer's own box.
- Drag a tab to a side of the other one to split them side by side or one above the other, or onto another row of
  tabs to move it; the line between two groups resizes them. Project tabs reorder by dragging along the title bar.
- Scrollbars show only while scrolling or under the pointer.

## 0.0.4

A git panel to stage and commit, and a thread's changes in a tab of their own.

- Git, under Search, opens a sidebar with a commit box, Stage All and Commit (⌘↵), and the changed files with a
  checkbox to stage each; beside it a tab shows every changed file's diff, one under another, and a file clicked in the
  sidebar scrolls there.
- A folder holding several repositories shows each one as its own group, with its branch and commit box.
- Changes, in the right panel, opens a tab with every file the thread changed, for the whole thread or one turn.
- The right panel keeps Changes and Tasks; Files stays in the activity bar.

## 0.0.3

The projects screen shows each project's sessions, and the title bar opens projects without leaving where you are.

- The projects screen lists your projects on the left and the picked one's sessions on the right, with a search; a
  session opens in its project's tab, and New session starts one there.
- The `+` in the title bar opens a menu of recent and other projects, with a search and Open folder, instead of going
  to the projects screen.
- A button at the left of the title bar goes back to the projects screen.
- Calm empty states when there are no projects, no sessions in a project, or no matches.
- Tabs keep one width: a long title fades out at its end, the close button shows on hover, and always on the shown tab.

## 0.0.2

The desktop app drawn again from scratch, in a window laid out as a workbench.

- Projects open as tabs along the top, and come back when the app opens again.
- A thin activity bar opens Threads, Search, Changes, Files, Skills, Memory and Accounts; the middle shows tabs:
  threads first, and a change's diff, a file or a page beside them, split two side by side.
- The conversation keeps your message on top while its answer scrolls; what the agent did is quiet lines that open,
  an edit opens as a diff with line numbers, and a turn ends on what it changed.
- A new thread is its composer alone in the middle; questions come one at a time in the composer's place.
- The right panel lists the project's changes, files and tasks; the bottom one holds the tasks.
- Light and dark, following macOS, with short transitions.

## 0.0.1

The first version of Jinion's desktop app, for Apple silicon, unsigned.

- Opening a project is picking a folder; the recent ones come back on the projects screen.
- The same agent as the CLI, on Claude or Codex, picked in the composer's model menu, with the four modes.
- Threads in tabs and in the sidebar; one keeps working in the background, and a notification says when it ends or
  waits on you.
- Questions, permissions and plans to approve take the composer's place until answered.
- A side panel with the files a thread changed as diffs, the project's files read-only, and the todos and background
  commands.
- Skills, memory, and accounts to sign in with Claude or ChatGPT.
