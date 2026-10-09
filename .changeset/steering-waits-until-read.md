---
"@jinion/core": patch
"@jinion/cli": minor
"@jinion/ui": patch
"@jinion/desktop": patch
---

A message sent while the agent works waits above the prompt until the agent reads it, as soon as its current step is
done, and then joins the conversation at that point. Before, it showed in the conversation at once, so it was hard to
tell when the agent picked it up. Works with Claude and Codex.
