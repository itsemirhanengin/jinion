# @jinion/cli

## 0.0.6

### Patch Changes

- 1a9e26e: Code in color, by its language: the diffs of edits and writes, the `/diff` panel and the code blocks in replies. The
  diff keeps its added and removed backgrounds and the mark on what changed in a line.
- Updated dependencies [1a9e26e]
  - @jinion/tui@0.0.2

## 0.0.5

### Patch Changes

- Updated dependencies [54b3f00]
  - @jinion/core@0.0.5

## 0.0.4

### Patch Changes

- Updated dependencies [8f3d5aa]
  - @jinion/core@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies [5bb5b0b]
  - @jinion/core@0.0.3

## 0.0.2

### Patch Changes

- 8b6ce2e: The core starts from `@jinion/core/host`, takes clients over a message channel (`portTransport`), and reads a file in a
  session's folder with `files/read`, all for the desktop app. The CLI works as before.
- Updated dependencies [8b6ce2e]
  - @jinion/core@0.0.2

## 0.0.1

The first version of Jinion, a coding agent for the terminal.

- Works with Claude, signed in with a claude.ai subscription, and with Codex, signed in with ChatGPT. `/model` lists
  both; picking a model of the other hands the conversation over.
- Four permission modes: Manual, Accept edits, Plan and Auto, where a safety check stops actions beyond the request.
- Conversations in tabs, resumed with `/resume`, rewound to any message with the files put back, and each in a git
  worktree of its own when worktrees are on.
- `/diff` and a card of what each turn changed, background tasks, subagents shown under the call that started them.
- Memory that carries over between conversations, project instructions, skills and MCP servers.
- `/usage`, `/stats`, `/context` and `/compact`, a status line built from segments, notifications when a turn ends.
- `jinion serve` runs the core without a screen, on a WebSocket or over stdio, and `jinion --attach` shows its
  conversations.
