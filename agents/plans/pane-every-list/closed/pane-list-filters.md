---
title: A row at the top of the pane filters its items by list and by state, and can show only one turn
state: superseded
superseded-by: pane-facet-tree
kind: implementation
part-of: pane-every-list
needs: [items-of-every-list, pane-ui-harmonize, pane-state-reducer, pane-decide-filters]
touches: [plugin/hooks/register.tsx, plugin/src/pane/view.ts, plugin/src/pane/filters.ts, plugin/defaults/config.yaml, plugin/types/index.d.ts, plugin/test/engine/]
---

# A row at the top of the pane filters its items by list and by state, and can show only one turn

- **The row.** It extends the row [pane-decide-filters](pane-decide-filters.md) puts under the pane's header row, which holds the answered, unanswered and Done toggles: it adds one toggle per list, by its glyph, the **Only show this turn** checkbox, then **Set default** and **Reset**. Its Done toggle then applies to every list's Done items.
- **What's visible.** An item is visible when its list's toggle is on, its state's toggle is on, and, with **Only show this turn** on, it's in the turn ◀ and ▶ last reached. The predicate pane-decide-filters puts in `plugin/src/pane/filters.ts` grows to say so, and the pane's sections and ◀ and ▶ all use it.
- **Hidden means not drawn.** An item or section the predicate hides makes no elements and takes no layout.
- **Counts.** A toggle that's off shows how many items it hides across every turn of the session.
- **Defaults.** The default set under `pane` in `plugin/defaults/config.yaml`, which pane-decide-filters adds, gains the list toggles and the checkbox, and ships every toggle on and the checkbox off. **Set default** writes the current set, the checkbox among it, to the plugin's `$.store`, which the pane reads at session start over the shipped default, on this machine across sessions. **Reset** turns every toggle on and the checkbox off.

Checks: tests in `plugin/test/unit/` for the predicate and the counts; engine tests in `plugin/test/engine/` that turn a toggle off and find its items gone from the rendered tree, for Set default carried to a new session, and for Reset.
