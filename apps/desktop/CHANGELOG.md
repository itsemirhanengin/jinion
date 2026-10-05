# @jinion/desktop

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
