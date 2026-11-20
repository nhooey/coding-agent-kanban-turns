---
title: Submit moves the items it answers to Done at once, and the turn's end confirms them or puts them back
state: approved
kind: implementation
part-of: pane-every-list
needs: [pane-turn-sections, answers-grouped-by-turn-and-list, pane-submit-review-fixes]
touches: [plugin/hooks/register.tsx, plugin/src/raised.ts, plugin/src/sections.ts, plugin/plugin-tests/]
---

# Submit moves the items it answers to Done at once, and the turn's end confirms them or puts them back

- **At once.** On **Submit**, each item whose answer settles it, by its list's word or a Decide item's answer, moves into its group's Done section, which may be collapsed or hidden by the filters. A Note alone moves nothing but a Decide item.
- **Confirmed or put back.** The transcript read at the end of the turn the prompt starts keeps each moved item Done where it shows the item settled, and puts the rest back among the Open items.
- **One rule for Done.** An item settled any other way, a merged pull request, a `reassess` that leaves it out, a report for a Waiting item, is in its Done section too.
- **Pure.** Which items move, and which come back after the read, are pure functions of the submitted draft, the items and the read's result.

Checks: tests in `plugin/test/` for the move and for the confirm and put-back; an engine test in `plugin/plugin-tests/` that submits answers, finds the items in their Done sections before the turn ends, and then a transcript that settles one and not the other.
