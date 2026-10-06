# @jinion/workbench

## 0.0.8

### Patch Changes

- 417f83d: Terminals in the bottom panel, which belong to the project, so they stay open from one thread to the next. A terminal
  opens at once when the panel shows none, can be split into panes side by side, and is listed on the right with the
  panes of a split together; the right panel has Terminal beside Changes. The agent reads the terminals and starts what
  keeps running, such as a dev server, in one of them, asked about as a command is; the panel opens on it. Prompts drawn
  with powerline arrows show as they do in other terminals, and stay readable on the light theme. Tasks shows only when a
  thread has some. The core gets `terminals/*` methods and notifications, an addition that keeps `PROTOCOL_VERSION`.

## 0.0.7

### Patch Changes

- Updated dependencies [a02dd14]
  - @jinion/ui@0.0.7

## 0.0.6

### Patch Changes

- Updated dependencies [ce193fb]
  - @jinion/ui@0.0.6

## 0.0.5

### Patch Changes

- Updated dependencies [54b3f00]
  - @jinion/ui@0.0.5

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
- Updated dependencies [380912f]
  - @jinion/ui@0.0.4

## 0.0.3

### Patch Changes

- 8f3d5aa: A git panel to stage and commit, and a thread's changes in a tab of their own.
  
  - Git, under Search, opens a sidebar with a commit box, Stage All and Commit (⌘↵), and the changed files with a
    checkbox to stage each; beside it a tab shows every changed file's diff, one under another, and a file clicked in the
    sidebar scrolls there.
  - A folder holding several repositories shows each one as its own group, with its branch and commit box.
  - Changes, in the right panel, opens a tab with every file the thread changed, for the whole thread or one turn.
  - The right panel keeps Changes and Tasks; Files stays in the activity bar.

## 0.0.2

### Patch Changes

- 5bb5b0b: The projects screen shows each project's sessions, and the title bar opens projects without leaving where you are.
  
  - The projects screen lists your projects on the left and the picked one's sessions on the right, with a search; a
    session opens in its project's tab, and New session starts one there.
  - The `+` in the title bar opens a menu of recent and other projects, with a search and Open folder, instead of going
    to the projects screen.
  - A button at the left of the title bar goes back to the projects screen.
  - Calm empty states when there are no projects, no sessions in a project, or no matches.
  - Tabs keep one width: a long title fades out at its end, the close button shows on hover, and always on the shown tab.
- Updated dependencies [5bb5b0b]
  - @jinion/ui@0.0.3

## 0.0.1

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
- Updated dependencies [0200d0f]
  - @jinion/ui@0.0.2
