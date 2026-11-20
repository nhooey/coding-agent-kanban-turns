---
title: A row at the top of the pane filters its items by list and by state, and can show only one turn
state: approved
kind: implementation
part-of: pane-every-list
needs: [items-of-every-list, pane-ui-harmonize]
touches: [plugin/hooks/register.tsx, plugin/src/view.ts, plugin/src/filters.ts, plugin/defaults/config.jsonc, plugin/types/index.d.ts, plugin/plugin-tests/]
---

# A row at the top of the pane filters its items by list and by state, and can show only one turn

- **The row.** Under the pane's header: one toggle per list, by its glyph, one for Done items, the **Only show this turn** checkbox, then **Set default** and **Reset**.
- **What's visible.** An item is visible when its list's toggle is on, its state's toggle is on if it's Done, and, with **Only show this turn** on, it's in the turn ◀ and ▶ last reached. One pure predicate says so, and the pane's sections and ◀ and ▶ all use it.
- **Hidden means not drawn.** An item or section the predicate hides makes no elements and takes no layout.
- **Counts.** A toggle that's off shows how many items it hides across every turn of the session.
- **Defaults.** `plugin/defaults/config.jsonc` ships every toggle on and the checkbox off. **Set default** writes the current set, the checkbox among it, to the plugin's `$.store`, which the pane reads at session start over the shipped default, on this machine across sessions. **Reset** turns every toggle on and the checkbox off.

Checks: tests in `plugin/test/` for the predicate and the counts; engine tests in `plugin/plugin-tests/` that turn a toggle off and find its items gone from the rendered tree, for Set default carried to a new session, and for Reset.
