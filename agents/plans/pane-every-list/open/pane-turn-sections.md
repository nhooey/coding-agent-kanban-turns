---
title: The pane is one scrolling list, newest turn first, grouped by turn, list and state under headers
state: approved
kind: implementation
part-of: pane-every-list
needs: [items-of-every-list, pane-list-filters, pane-ui-harmonize]
touches: [plugin/hooks/register.tsx, plugin/src/view.ts, plugin/src/sections.ts, plugin/types/index.d.ts, plugin/plugin-tests/]
---

# The pane is one scrolling list, newest turn first, grouped by turn, list and state under headers

- **The grouping.** The pane draws one list, newest turn first; within a turn, its lists in the skill's order; within a list, its Open items, then its Done items. A list that nothing settles, ✅ Done, 📝 Logged and ❓ Answers, has its items straight under its header, with no state groups.
- **Headers.** Each group has a header with its own key. A turn's header carries its id and its index relative to the latest turn, which is `₀`, such as `9efb08a1 ₋3`.
- **A collapsed Done section** draws one header row with its count and expands on a click, and a second click collapses it again.
- **Hidden groups aren't drawn.** A group whose items [the filters](pane-list-filters.md) all hide makes no header and no elements.
- **No dividers.** `pane-ui-harmonize`'s turn dividers give way to the turn headers.
- **The sections are pure.** The grouping and the headers' text and keys come from pure functions of the items and the visibility predicate.

Checks: tests in `plugin/test/` for the grouping and the headers; engine tests in `plugin/plugin-tests/` that read the sections' order and expand and collapse a Done section.
