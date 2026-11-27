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

## Already true for every list the pane draws, in the reply

The pane, the reply's drawing and the draft's answers take one path for every list: what sets a list apart there is its spec `feedback` (`options`, `settling-words` or `none`) and the settings' labels, never its name. Raising and settling stay per list, by the spec.

- A reply names an item by its summary under its list's header: each numbered summary there names the newest raised item of that list with that summary, compared as `summaryOf` reads it, each item once (`linkedSummaries` in `plugin/src/pane/links.ts`). A line under no drawn list's header names nothing. A summary no raised item has is drawn as written, so a reply drawn while a turn runs draws the boxes of the items raised so far, until the turn's end raises its own Todo items.
- A list found intact is cut out and its items' boxes drawn in its place (`listSpan`): exactly one such list before any 📌 roll-up, its numbered summaries, each alone on its line, naming the items, every one and no other, in order, an options item's block also holding its options' letters and names. A Todo item's box has **Done**, **Skip** and `✏️ Add a note`, which opens the pane at the item's notes field, its label the `actions.note.label` setting.
- A list that isn't intact is drawn as written, its summaries links, every raised item it prints boxed under the whole reply in the spec's list order: one printing an item twice, some of whose items no turn raised, or with an item whose summary runs on into its sentence, among them.
- A reply with several lists intact has each cut out, each list's boxes in its own place (`replyDrawing`, then `replyParts`).
- The reply's boxes are the pane's `itemBoxes`, one frame for every list, whose answer row the feedback picks (`ANSWER_VIEWS` in `plugin/hooks/register.tsx`), so both write the same draft lines and each shows the other's presses.
- A new item of any list opens the pane by itself, and `/answers` scrolls to the first item of any list the draft writes nothing for.

Still to come:

- the outline per turn;
- the other lists' actions;
- a Note button in place of the field that the pane always draws.

Checks: an engine test in `plugin/test/engine/` per list that has actions, pressing each and reading the draft, one for a Note-only list, one pressing an action on a Done item, one reading a reply whose Todo list is drawn as boxes in its place, and one finding a turn's boxes inside one outline, in the pane and in the reply.
