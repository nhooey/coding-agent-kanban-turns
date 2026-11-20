---
title: Each turn's section in the pane holds every list's items, grouped by list under headers, each list with its own Done section
state: approved
kind: implementation
part-of: pane-every-list
needs: [items-of-every-list, pane-list-filters, pane-ui-harmonize, pane-state-reducer]
touches: [plugin/hooks/register.tsx, plugin/src/pane/view.ts, plugin/src/pane/sections.ts, plugin/types/index.d.ts, plugin/test/engine/]
---

# Each turn's section in the pane holds every list's items, grouped by list under headers, each list with its own Done section

**Already true for Decide items** (#36, #40): the pane is one scrolling list, newest turn first; each turn opens on a faint header with its id and its index counting back from the latest turn, `── 9efb08a1 ₋₂ ──`; and each turn's Done items fold under one `▸ Done (n)` toggle, collapsed at first, which a click opens and a second click closes. `plugin/src/pane/sections.ts` works the turn sections out as pure functions. This node takes those sections from Decide items to every list:

- **Every list's items.** A turn's section holds the items of all 9 lists from [items-of-every-list](items-of-every-list.md), not only its Decide items.
- **One outline per turn.** A turn's section, its list headers, item boxes and Done toggles, sits inside one outline, so the turn's items read as one block; each item's box stays inside it, and the boxes under a reply share the same outline ([list-actions](list-actions.md)).
- **Per-list sub-groups.** Within a turn, the lists come in the spec's order, each under a header with its glyph and name, such as `🧠 Decide`, drawn as faint as the turn's header. A list with no item in the turn has no header.
- **Done per list.** Within a list, its Open items come first, then its own `▸ Done (n)` toggle, which folds its Done items as the turn's toggle does today; the turn-wide toggle gives way to these, as the settled design. A list that nothing settles, ✅ Done, 📝 Logged and ❓ Answers, has its items straight under its header, with no toggle.
- **The ✅ Done list in every turn.** Every turn's section holds its own ✅ Done list items, under that list's header, not only the latest turn's.
- **Hidden groups aren't drawn.** A list header or Done toggle whose items [the filters](pane-list-filters.md) all hide makes no header and no elements, and a turn whose items they all hide has no header.
- **Keys.** Each header and toggle has its own key, so ↑ Previous and ↓ Next stop on each Done toggle, and [pane-turn-navigation](pane-turn-navigation.md) scrolls to a turn's header.
- **The sections are pure.** The grouping and the headers' text and keys come from pure functions of the items and the visibility predicate, in `plugin/src/pane/sections.ts`.

Checks: tests in `plugin/test/unit/` for the grouping by list and state and the list headers; engine tests in `plugin/test/engine/` that read the sections' order with items of several lists in one turn, and expand and collapse one list's Done section while another's stays as it was.
