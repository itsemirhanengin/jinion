---
"@jinion/desktop": patch
---

The last thread closes. Closing it used to bring back a New thread at once; now the window is left without a thread, its
composer in the middle, and the next new thread, from the button, ⌘N or that composer, reuses the empty conversation
kept behind it rather than piling up new ones.
