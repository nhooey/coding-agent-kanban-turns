---
title: Submit moves every list's items it settles to their Done sections at once, and the turn's end confirms them or puts them back
state: approved
kind: implementation
part-of: pane-every-list
needs: [pane-turn-sections, list-actions, answers-grouped-by-turn-and-list, pane-submit-review-fixes]
touches: [plugin/hooks/register.tsx, plugin/src/raised.ts, plugin/src/sections.ts, plugin/plugin-tests/]
---

# Submit moves every list's items it settles to their Done sections at once, and the turn's end confirms them or puts them back

**Already true for Decide items** (#36, #40): **📤 Submit** moves each Decide item the draft answers into its turn's Done section at once, its line saying `Sent: <letters>`, and the transcript read at the end of the turn the prompt starts keeps it there as answered, or puts it back among the open items. A refused prompt moves nothing. This node does the same for every list:

- **At once.** On **Submit**, each item of any list whose answer settles it, by its list's word from [kanban-skill-list-answers](kanban-skill-list-answers.md) or a Decide item's answer, moves into its list's Done section in its turn ([pane-turn-sections](pane-turn-sections.md)), which may be collapsed or hidden by the filters. Its line says what was sent, such as `Sent: done`. A Note alone moves nothing but a Decide item.
- **Confirmed or put back.** The transcript read at the end of the turn the prompt starts keeps each moved item Done where it shows the item settled, and puts the rest back among the Open items, as it does for Decide items.
- **One rule for Done.** An item settled any other way, a merged pull request for a Review item, a `reassess` that leaves it out, a report for a Waiting item, is in its Done section too.
- **Pure.** Which items move, and which come back after the read, are pure functions of the submitted draft, the items and the read's result, the ones that do it for Decide items today taking every list.

Checks: tests in `plugin/test/` for the move and for the confirm and put-back, with a Todo, a Review and a Waiting item; an engine test in `plugin/plugin-tests/` that submits answers to items of two lists, finds them in their Done sections before the turn ends, and then a transcript that settles one and not the other.
