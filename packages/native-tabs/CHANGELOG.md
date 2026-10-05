# @jinion/native-tabs

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
