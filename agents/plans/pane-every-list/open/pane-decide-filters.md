---
title: A row under the pane's header row hides Decide items by state, answered, unanswered or Done
state: approved
kind: implementation
part-of: pane-every-list
needs: [pane-state-reducer]
touches: [plugin/src/filters.ts, plugin/src/pane-state.ts, plugin/src/view.ts, plugin/hooks/register.tsx, plugin/defaults/config.yaml, plugin/types/index.d.ts, plugin/test/, plugin/plugin-tests/]
cost: "about 6M tokens over 2 runs, 1 implementer and 1 review; about $6 at Opus 5.5's rates; weekly share not costed, no weekly limit set"
---

# A row under the pane's header row hides Decide items by state, answered, unanswered or Done

The pane filters the Decide items it holds today, ahead of the every-list chain from [items-of-every-list](items-of-every-list.md) on. [pane-list-filters](pane-list-filters.md) later extends this row with a toggle per list.

- **The row.** Under the pane's header row, one toggle for each of a Decide item's three states:
  - **answered:** an option is chosen in the draft, or the answer is sent and the turn's end hasn't read it yet;
  - **unanswered:** open, with no option chosen;
  - **Done:** settled, as the transcript reads it.
- **What's visible.** An item is visible when its state's toggle is on. One pure predicate in `plugin/src/filters.ts` says so, and the pane's sections and the focus ring's stops, for j and k and ↑ and ↓, all use it.
- **Hidden means not drawn.** An item or a section the predicate hides makes no elements and takes no layout.
- **Counts.** A toggle that's off shows how many items it hides, across every turn of the session.
- **State.** The toggles are a field of [pane-state-reducer](pane-state-reducer.md)'s `PaneState`, and a click on one is an `Event` that `step` handles.
- **Defaults.** Every toggle is on by default. The default set is a setting under `pane` in `plugin/defaults/config.yaml`, with its comment, which a session's toggles start from.

Checks:

- tests in `plugin/test/` of the predicate and the counts, for each state alone and in combination, and of `step` for a toggle's click;
- engine tests in `plugin/plugin-tests/` that turn each toggle off and find its items gone from the rendered tree and its count on the toggle, and turn it on again and find them back;
- an engine test of a default set with a toggle off, read from the settings.
