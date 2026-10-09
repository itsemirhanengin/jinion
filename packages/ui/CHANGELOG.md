# @jinion/ui

## 0.0.9

### Patch Changes

- ebe5ef4: A message sent while the agent works waits above the prompt until the agent reads it, as soon as its current step is
  done, and then joins the conversation at that point. Before, it showed in the conversation at once, so it was hard to
  tell when the agent picked it up. Works with Claude and Codex.

## 0.0.8

### Patch Changes

- b12cc63: Plans of their own. A plan opens by itself beside its thread, a third of the window, as a document you can change before
  you answer: headings, marks over a selection, lists and task lists, code, tables, and Mermaid diagrams, drawn, and
  edited in a window of their own with the drawing following the text. A bar over the plan says where it stands and
  answers it, Keep planning or Build in a mode, as the panel under the conversation does. A plan you changed goes to the
  agent with a line saying you changed it, so it builds your version. The conversation shows a plan as one row that opens
  it, diagrams are drawn there too, Esc in the plan leaves the turn running, and the agent is asked to write plans as a
  short document with a diagram, steps, the files and the risks. The demo agent plans when asked to.

## 0.0.7

### Patch Changes

- a02dd14: Comments on a diff go to the agent as one message. In the Changes and Git tabs, the `+` beside a line comments on it,
  and dragging it across the numbers comments on several; a comment stays under its lines, follows them as the file
  changes, and shows as outdated once they are gone. The comments wait in the composer as a pill and go with the next
  message, each with the lines it is on, or alone from the tab's Send.

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

- 380912f: A calmer conversation, and tabs that split and move by dragging.
  
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

- 0200d0f: The desktop app drawn again from scratch, in a window laid out as a workbench.
  
  - Projects open as tabs along the top, and come back when the app opens again.
  - A thin activity bar opens Threads, Search, Changes, Files, Skills, Memory and Accounts; the middle shows tabs:
    threads first, and a change's diff, a file or a page beside them, split two side by side.
  - The conversation keeps your message on top while its answer scrolls; what the agent did is quiet lines that open,
    an edit opens as a diff with line numbers, and a turn ends on what it changed.
  - A new thread is its composer alone in the middle; questions come one at a time in the composer's place.
  - The right panel lists the project's changes, files and tasks; the bottom one holds the tasks.
  - Light and dark, following macOS, with short transitions.
