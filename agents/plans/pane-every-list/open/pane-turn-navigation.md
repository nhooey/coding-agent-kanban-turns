---
title: ◀ and ▶ jump the pane between turns with a visible item, and Only show this turn draws just the one they reached
state: approved
kind: implementation
part-of: pane-every-list
needs: [pane-turn-sections, pane-list-filters, pane-state-reducer]
touches: [plugin/hooks/register.tsx, plugin/src/pane/view.ts, plugin/src/pane/sections.ts, plugin/defaults/config.yaml, plugin/types/index.d.ts, plugin/test/engine/]
---

# ◀ and ▶ jump the pane between turns with a visible item, and Only show this turn draws just the one they reached

**Already true**: the pane's header row holds `↑ Previous` and `↓ Next`, on `keys.previous` (`k`) and `keys.next` (`j`), which move the focus ring stop by stop, each branch's header, each turn's header, an open or queued item's first option or a Done line, the pane scrolled to show it, each dim at its end. They stay as they are; ◀ and ▶ move by whole turns beside them:

- **◀ and ▶ jump by turn, across the branches.** `◀ Turn` and `▶ Turn` sit in the header row after `↑ Previous` and `↓ Next`, in the pane's order as those are ([pane-turn-sections](pane-turn-sections.md)): the Open branch's turns, newest first, then the Queued branch's, then the Done branch's. ▶ from the last turn under Open reaches the first turn under Queued, and from the last under Queued the first under Done; ◀ goes back the same way. A turn with items in two branches is reached once in each.
- **What they reach.** Each moves the focus ring to the header of the next turn that way with an item [the filters](pane-list-filters.md) leave visible, skipping turns whose items are all hidden, and scrolls the pane to that header with `$.ui.scroll`. A folded turn's header is drawn, so they reach it; a collapsed branch draws no turn headers, so they skip its turns, as ↑ and ↓ do. The pane keeps the turn they reached. They don't page. A button with no such turn to reach is drawn dim, as ↑ and ↓ are at their ends.
- **Keys.** Each is a setting under `keys` in `plugin/defaults/config.yaml`, `keys.previous-turn` (`p`) and `keys.next-turn` (`n`), drawn before its button as `p: ◀ Turn`, listed in the `? Keys` panel, and held to the same rules as the other keys: one lowercase letter or digit, no two settings on one key. These labels and keys are the settled design.
- **Only show this turn.** With the checkbox on, only the turn ◀ and ▶ last reached is drawn, the latest one until they're pressed, in every branch it has items in, each under its branch's header; ◀ and ▶ then swap which turn that is. ↑ and ↓ move within that turn's groups alone.
- **Pure stepping.** Which turn ◀ and ▶ reach comes from a pure function of the groups, the folds, the visibility predicate and the current turn, beside the one in `plugin/src/pane/sections.ts` that gives ↑ and ↓ their stops.

Checks: tests in `plugin/test/unit/` for the stepping, with hidden turns between visible ones and at both ends, across a branch boundary and past a collapsed branch, and for the key settings refusing a clash with `keys.next`; engine tests in `plugin/test/engine/` that jump back and forward by button and by key, that read both rows in the `? Keys` panel, and that turn on Only show this turn and swap turns, a turn with items in two branches drawn in both.
