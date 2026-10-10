---
"@jinion/core": patch
"@jinion/cli": patch
"@jinion/desktop": patch
---

A folder with thousands of changed files no longer freezes the changes: the lines changed are counted in the
background, and again only once a file changes. In the desktop app, Git, Changes and the threads draw only the rows in
view and load each diff as it shows.
