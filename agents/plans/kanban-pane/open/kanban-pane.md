---
title: The pane holds every Decide item raised, the transcript draws a turn's items after its reply, and the prompt keeps only the count line
state: proposed
kind: end-state
---

# The pane holds every Decide item raised, the transcript draws a turn's items after its reply, and the prompt keeps only the count line

With the coding-agent-kanban-turns mod loaded:

- **The pane is where items are answered.** A pane lists every Decide item raised in the session, oldest first and the newest at the bottom, each with its buttons, so the questions accumulate as turns raise them. A settled item stays in the list, dimmed, with its buttons turned off. The pane opens by itself, without taking the keyboard, when the session starts with open items and when a turn raises a new one, and a submitted prompt leaves it open.
- **A turn's items follow its reply.** In the transcript, a reply's Decide items are drawn with their buttons directly under the reply that raised them, not above it on the `kanban_options` tool row, which draws nothing unless it's expanded, failed or interrupted.
- **Above the prompt, one line.** The line above the prompt holds the skill's count line, as `outstanding.py render --counts` prints it, such as `📌 Outstanding: 🚧 1 · 🔍 2 · 👉 1 · 🧠 5`, then a window button, `🪟 ↗`, that opens the pane. No item is drawn above the prompt, and with no count line nothing is.
- **A click still only writes the draft.** A button writes the item's reference, on a line of its own and ending in a newline, into the prompt draft, in the pane and in the transcript alike, and sends nothing.

Checks: the repository's checks pass, with an engine test in `mod/mod-tests/` for each bullet above.
