---
title: The draft's answers are grouped by turn and list, with context in parentheses, and the plugin reads them back
state: approved
kind: implementation
part-of: pane-every-list
needs: [kanban-skill-list-answers, pane-submit-review-fixes]
touches: [plugin/src/answers.ts, plugin/src/outstanding.ts, plugin/test/]
---

# The draft's answers are grouped by turn and list, with context in parentheses, and the plugin reads them back

- **Writing.** Adding, changing or removing an answer gives the draft back with its answers grouped: the first line `coding-agent-kanban-turns@nix-pinned:`, then a `<turn>.<List>` line per turn and list, in turn order and the lists' order, and under each an indented line per item, in number order, `<n>[.<letters>][ (<context>)][: <word or note>]`. The context is the item's summary, then `→` and the chosen options' names for a Decide item, with no parentheses or line breaks of its own. A trailing `reassess` line, from the Reassess toggle, stays last.
- **Reading.** The draft and the user's prompts are parsed line by line into groups, by a parser over that grammar rather than a regular expression per form: an item line answers its group's turn and list, never the turn before as a bare numbered line `2. B` does, and the context is skipped. Plain references, anywhere in the text, read as they do today.
- **Round trip.** Reading what the writer wrote gives back the same answers, and text the user typed outside the groups is kept where it was.

Checks: tests in `plugin/test/` for the grouped example in [the end state](pane-every-list.md), for a word with a note, for a context holding `:` or `→`, for a plain reference beside a group, and for the round trip.
