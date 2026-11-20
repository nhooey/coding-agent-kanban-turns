---
title: Each item's box, in the pane and under its reply, carries its list's actions
state: approved
kind: implementation
part-of: pane-every-list
needs: [items-of-every-list, answers-grouped-by-turn-and-list, pane-ui-harmonize]
touches: [plugin/hooks/register.tsx, plugin/src/view.ts, plugin/src/items.ts, plugin/defaults/config.jsonc, plugin/plugin-tests/]
---

# Each item's box, in the pane and under its reply, carries its list's actions

- **Boxes for every list.** Under a reply, each of its items has a box, drawn as `pane-ui-harmonize` draws a Decide item's, in that one style, its list's glyph and name on its title line; the pane draws the same box.
- **The actions.** Each box carries the actions [the end state](pane-every-list.md)'s table gives its list. Pressing one writes the item's answer into the draft through [answers-grouped-by-turn-and-list](answers-grouped-by-turn-and-list.md), and pressing it again takes it out. Note opens the item's notes field, and the note goes after `: `, or after the chosen word and `: `.
- **Done boxes.** A settled item is Done, in the UI's words: its box shows the answer that settled it, its actions turned off, as `pane-submit-review-fixes` does for a Decide item.
- **The words are data.** Each list's actions and words are one table in the core, with the labels in `plugin/defaults/config.jsonc` where a user may rename them.

Checks: an engine test in `plugin/plugin-tests/` per list that has actions, pressing each and reading the draft, and one for a Note-only list.
