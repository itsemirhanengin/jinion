# @jinion/ui

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
