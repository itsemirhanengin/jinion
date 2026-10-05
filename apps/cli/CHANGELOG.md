# @jinion/cli

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
