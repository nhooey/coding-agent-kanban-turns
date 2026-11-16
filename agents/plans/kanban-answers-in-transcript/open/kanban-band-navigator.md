---
title: The band becomes the navigator of the outstanding items, stepping through them in the transcript
state: approved
kind: implementation
part-of: kanban-answers-in-transcript
needs:
  [kanban-mod-reads-transcript, kanban-items-tool-row, kanban-answers-basket]
touches:
  [
    plugins/coding-agent-kanban-answers/hooks/register.tsx,
    plugins/coding-agent-kanban-answers/README.md,
  ]
---

# The band becomes the navigator of the outstanding items, stepping through them in the transcript

- The `AbovePrompt` hook draws a header line, `🧠 4 open · ⏪ ⏩ · 📨 Submit (2)`, then one line per outstanding item from the mod's own transcript reader, grouped under its list's glyph, each opening on its dot, the shown item's ringed. Its height is the item count, capped at the band's `maxRows`, and it scrolls within itself past that.
- ⏪, ⏩ and a click on an item's line call `$.ui.scroll({ to: { key: ref }, block: "center" })`; the engine allows it because it answers the user's click.
- When the scroll is denied, because the item's row was compacted away or never drawn, the pane opens at the item instead, drawn by the same view as the row.
- The band's full item view, its height checks and the ❌ fold go; `/answers` opens the pane.
- The mod draws nothing in a reply: the `AssistantMessage` hook and the question links go, since the reply holds no items.
