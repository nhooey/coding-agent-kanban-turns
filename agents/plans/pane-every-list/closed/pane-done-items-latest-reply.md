---
title: The pane holds only the latest turn's ✅ Done list items, and earlier ones stay under their replies
state: superseded
kind: implementation
part-of: pane-every-list
superseded-by: pane-turn-sections
needs: [list-actions, pane-turn-navigation]
touches: [plugin/src/sections.ts, plugin/src/filters.ts, plugin/plugin-tests/]
---

# The pane holds only the latest turn's ✅ Done list items, and earlier ones stay under their replies

- **In the pane.** The ✅ Done list's items are in the latest turn's section only. An earlier turn's section has no ✅ Done group, and a turn whose only items are ✅ Done items has no section, so ◀ and ▶ skip it.
- **Under replies.** Every reply keeps its ✅ Done items' boxes, each with its Note button.
- **Counts.** The ✅ Done toggle's count, when it's off, counts the ✅ Done items the pane would hold.

Checks: an engine test in `plugin/plugin-tests/` with ✅ Done items in two turns, reading the pane's sections and the earlier reply's boxes.
