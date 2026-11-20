---
title: The plugin's core reads every list's items per turn, each with whether it's settled and by what answer
state: approved
kind: implementation
part-of: pane-every-list
needs: [kanban-skill-list-answers, pane-submit-review-fixes, protocol-spec-data, pane-state-reducer]
touches: [plugin/src/transcript/turns.ts, plugin/src/items/outstanding.ts, plugin/src/items/raised.ts, plugin/src/items/items.ts, plugin/types/index.d.ts, plugin/test/unit/]
---

# The plugin's core reads every list's items per turn, each with whether it's settled and by what answer

- **Every list's items.** The core reads, from the session's transcript, each reply's items of all 9 lists, by turn id, list and number, with the summary and body the reply printed. A Decide item keeps its options as the `kanban_options` call gave them.
- **One item shape.** A list item carries its list, so the pane and the boxes under a reply draw items of any list through one type in `plugin/types/index.d.ts`; a Decide item is the case that has options.
- **Settled, and by what.** An item is settled by its list's word, as [kanban-skill-list-answers](kanban-skill-list-answers.md) gives them, by a merged pull request for a Review item, by a report for a Waiting item, and by an answer for a Decide item, as today. The answer that settled it is kept, so a settled item shows it.
- **Pure.** No I/O and no `claude-code` import: the hooks read the transcript and call these functions.

Checks: a test in `plugin/test/unit/` for each function, with a transcript holding all 9 lists and an answer settling an item of each list that has actions.
