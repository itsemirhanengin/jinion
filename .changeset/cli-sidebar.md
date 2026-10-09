---
"@jinion/tui": patch
"@jinion/cli": minor
---

Open conversations move from the row of tabs above the conversation to a column on the left, one per row, with a
spinner while one works and `?` while it waits on you. A click anywhere on a row goes to it. In a terminal narrower than
100 columns the column keeps only each number and mark, and `ctrl+s` hides it and shows it again.
