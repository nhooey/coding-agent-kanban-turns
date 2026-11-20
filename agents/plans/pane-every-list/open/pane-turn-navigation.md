---
title: ◀ and ▶ jump the pane between turns with a visible item, and Only show this turn draws just the one they reached
state: approved
kind: implementation
part-of: pane-every-list
needs: [pane-turn-sections, pane-list-filters]
touches: [plugin/hooks/register.tsx, plugin/src/view.ts, plugin/src/sections.ts, plugin/defaults/config.yaml, plugin/types/index.d.ts, plugin/plugin-tests/]
---

# ◀ and ▶ jump the pane between turns with a visible item, and Only show this turn draws just the one they reached

**Already true** (#36, #40): the pane's header row holds `↑ Previous` and `↓ Next`, on `keys.previous` (`k`) and `keys.next` (`j`), which move the focus ring item by item, an open item's first option or a Done header or line, the pane scrolled to show it, each dim at its end of the items. They stay as they are; ◀ and ▶ move by whole turns beside them:

- **◀ and ▶ jump by turn.** `◀ Turn` and `▶ Turn` sit in the header row after `↑ Previous` and `↓ Next`, in the pane's order as those are: ◀ reaches the turn section above, a newer turn, and ▶ the one below, an older turn. Each moves the focus ring to the first stop of the next turn that way with an item [the filters](pane-list-filters.md) leave visible, skipping turns whose items are all hidden, and scrolls the pane to that turn's header with `$.ui.scroll`. The pane keeps the turn they reached. They don't page. A button with no such turn to reach is drawn dim, as ↑ and ↓ are at their ends.
- **Keys.** Each is a setting under `keys` in `plugin/defaults/config.yaml`, `keys.previous-turn` (`p`) and `keys.next-turn` (`n`), drawn before its button as `p: ◀ Turn`, listed in the `? Keys` panel, and held to the same rules as the other keys: one lowercase letter or digit, no two settings on one key. These labels and keys are the settled design.
- **Only show this turn.** With the checkbox on, only the turn ◀ and ▶ last reached is drawn, the latest one until they're pressed, and ◀ and ▶ swap which turn that is. ↑ and ↓ then move within that turn alone.
- **Pure stepping.** Which turn ◀ and ▶ reach comes from a pure function of the sections, the visibility predicate and the current turn, beside the one in `plugin/src/sections.ts` that gives ↑ and ↓ their stops.

Checks: tests in `plugin/test/` for the stepping, with hidden turns between visible ones and at both ends, and for the key settings refusing a clash with `keys.next`; engine tests in `plugin/plugin-tests/` that jump back and forward by button and by key, that read both rows in the `? Keys` panel, and that turn on Only show this turn and swap turns.
