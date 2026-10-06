---
"@jinion/core": patch
"@jinion/workbench": patch
"@jinion/desktop": patch
---

Terminals in the bottom panel, which belong to the project, so they stay open from one thread to the next. A terminal
opens at once when the panel shows none, can be split into panes side by side, and is listed on the right with the
panes of a split together; the right panel has Terminal beside Changes. The agent reads the terminals and starts what
keeps running, such as a dev server, in one of them, asked about as a command is; the panel opens on it. Prompts drawn
with powerline arrows show as they do in other terminals, and stay readable on the light theme. Tasks shows only when a
thread has some. The core gets `terminals/*` methods and notifications, an addition that keeps `PROTOCOL_VERSION`.
