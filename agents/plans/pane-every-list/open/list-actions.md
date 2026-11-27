---
title: Each item's box, in the pane and in its reply, carries its list's actions
state: approved
kind: implementation
part-of: pane-every-list
needs: [items-of-every-list, answers-grouped-by-turn-and-list, pane-ui-harmonize, pane-state-reducer]
touches: [plugin/hooks/register.tsx, plugin/src/pane/links.ts, plugin/src/pane/view.ts, plugin/src/items/items.ts, plugin/defaults/config.yaml, plugin/test/engine/]
---

# Each item's box, in the pane and in its reply, carries its list's actions

- **Boxes for every list.** Each item of a reply has a box, in the one style the pane and the reply share, its list's glyph and name on its title line, such as `👉 Todo.3`. In the reply, a list found intact is cut out and its boxes drawn in its place, as a Decide list is; a list that isn't is drawn whole, with its boxes under the reply. The pane draws the same box. Cutting every list out of the reply this way is the settled design.
- **One outline per turn.** A turn's boxes sit inside one outline round them all, in the pane and in the reply, so a turn's items read as one block; each item's box stays whole inside it.
- **The actions.** Each box carries the actions [the end state](pane-every-list.md)'s table gives its list. Pressing one writes the item's answer into the draft through [answers-grouped-by-turn-and-list](answers-grouped-by-turn-and-list.md), and pressing it again takes it out. Note opens the item's notes field, in the pane, or opens the pane on it from a reply, as `✏️ Add a note` does for a Decide item; the note goes after `: `, or after the chosen word and `: `.
- **Done boxes.** A settled item is Done, in the UI's words: its box is dimmed, says what made it Done, and keeps the answer that settled it marked, and its actions still write the draft, as a Done Decide item's options do.
- **The words are data.** Each list's actions and words are one table in the core, with the labels in `plugin/defaults/config.yaml` where a user may rename them.

## Already true for Todo, in the pane

- A Todo item's box carries **Done** and **Skip**, their labels and the Done row's words for them under `actions.todo` in `plugin/defaults/config.yaml`.
- Each writes `Todo.<n>: done` or `skip`, and a second press takes it out.
- The notes field writes the note after the word, or alone.
- A Done Todo item's box is dimmed and says `Done: done` or `Done: skipped`, with any note, and its actions still write the draft.

## Already true for Todo, in the reply

- A reply's Todo list found intact is cut out and its items' boxes drawn in its place, with **Done**, **Skip** and `✏️ Add a note`, which opens the pane at the item's notes field, its label the `actions.note.label` setting. Intact is Decide's rule: exactly one Todo list before any 📌 roll-up, its numbered summaries, each alone on its line, naming the items, every one and no other, in order, a summary compared as `summaryOf` reads it (`todoListSpan` in `plugin/src/pane/links.ts`).
- A Todo list that isn't intact is drawn as written, its boxes under the whole reply, before the Decide boxes there: one printing an item twice, or some of whose items no turn raised, among them.
- A reply with both lists intact has each cut out, each list's boxes in its own place (`replyParts`); where only the Decide list is cut, the Todo boxes follow the text after it.
- The reply's boxes are the pane's `itemBoxes`, so both write the same draft lines and each shows the other's presses.
- A reply block's Todo items are those of the turn that raised the most of the items it prints, by number and summary, the newest of those that tie, each once (`printedTodoItems`), since the engine doesn't say which turn drew the block.
- While a main-loop turn runs, no reply draws Todo boxes, each Todo list drawn as written, since the running turn's reply may print a list an earlier turn raised, and its own items are raised only at its end.
- A Todo list that isn't intact gets no links on its summaries, as a Decide list does; that waits on the user's choice (411b1c98.Decide.1).

Still to come:

- the outline per turn;
- the other lists' actions;
- a Note button in place of the field that the pane always draws.

Checks: an engine test in `plugin/test/engine/` per list that has actions, pressing each and reading the draft, one for a Note-only list, one pressing an action on a Done item, one reading a reply whose Todo list is drawn as boxes in its place, and one finding a turn's boxes inside one outline, in the pane and in the reply.
