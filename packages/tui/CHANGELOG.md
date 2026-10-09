# @jinion/tui

## 0.0.3

### Patch Changes

- ebe5ef4: Open conversations move from the row of tabs above the conversation to a column on the left, one per row, with a
  spinner while one works and `?` while it waits on you. A click anywhere on a row goes to it. In a terminal narrower than
  100 columns the column keeps only each number and mark, and `ctrl+s` hides it and shows it again.

## 0.0.2

### Patch Changes

- 1a9e26e: Code in color, by its language: the diffs of edits and writes, the `/diff` panel and the code blocks in replies. The
  diff keeps its added and removed backgrounds and the mark on what changed in a line.
