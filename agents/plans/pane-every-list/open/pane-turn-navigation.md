---
title: ◀ and ▶ scroll the pane between turns with a visible item, and Only show this turn draws just the one they reached
state: approved
kind: implementation
part-of: pane-every-list
needs: [pane-turn-sections, pane-list-filters]
touches: [plugin/hooks/register.tsx, plugin/src/view.ts, plugin/src/sections.ts, plugin/types/index.d.ts, plugin/plugin-tests/]
---

# ◀ and ▶ scroll the pane between turns with a visible item, and Only show this turn draws just the one they reached

- **◀ and ▶ scroll.** They call `$.ui.scroll` to the header key of the previous or next turn section with an item [the filters](pane-list-filters.md) leave visible, skipping turns whose items are all hidden, and the pane keeps the turn they reached. They don't page. A button with no such turn to reach is drawn turned off.
- **Only show this turn.** With the checkbox on, only the turn ◀ and ▶ last reached is drawn, the latest one until they're pressed, and ◀ and ▶ swap which turn that is.
- **Pure stepping.** Which turn ◀ and ▶ reach comes from a pure function of the sections, the visibility predicate and the current turn.

Checks: tests in `plugin/test/` for the stepping, with hidden turns between visible ones and at both ends; engine tests in `plugin/plugin-tests/` that scroll back and forward, and that turn on Only show this turn and swap turns.
