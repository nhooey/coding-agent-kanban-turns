---
title: The pane lists every Decide item raised in the session and opens by itself when a turn raises one
state: implemented
kind: implementation
part-of: kanban-pane
touches: [plugin/hooks/register.tsx, plugin/src/raised.ts, plugin/types/index.d.ts, plugin/plugin-tests/]
---

# The pane lists every Decide item raised in the session and opens by itself when a turn raises one

- **The raised items are state.** An atom holds every item a `kanban_options` call drew, added at `tool.call` and deduplicated by reference, merged with the open items each refresh of `outstanding.py decide --json` brings. An item is settled once it's no longer among the open items, or is in `settledRefs`.
- **The pane draws the list.** Each item is in a rounded box, drawn by `itemView` as the tool row draws it, oldest first; a settled one dimmed and not clickable. 🔄 Reassess and ❌, which closes the pane, sit on top; Prev, Skip, Next and the progress marks go, since a list needs none of them.
- **The newest is in view.** When an item is added, the pane scrolls to it, where the engine lets a mod scroll its pane to an element.
- **It opens by itself.** `$.ui.open` without `focus` at `session.start` with open items and at a main-agent `turn.complete` that raised a new item; `prompt.submit` no longer closes it. `/answers` opens it with the keyboard.
