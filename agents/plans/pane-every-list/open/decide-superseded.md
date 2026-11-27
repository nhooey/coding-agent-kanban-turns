---
title: A Decide item a later one restates is Done, superseded, and each of the two links to the other
state: approved
kind: implementation
part-of: pane-every-list
touches:
  [
    plugin/src/items/items.ts,
    plugin/src/items/outstanding.ts,
    plugin/src/items/raised.ts,
    plugin/src/items/answers.ts,
    plugin/src/items/answer-lines.ts,
    plugin/src/items/roll-up.ts,
    plugin/src/pane/view.ts,
    plugin/src/pane/links.ts,
    plugin/src/pane/sections.ts,
    plugin/cli/neutral.ts,
    plugin/src/protocol/instructions.ts,
    plugin/spec/fragments/tool.md,
    plugin/spec/kanban.yaml,
    plugin/hooks/register.tsx,
    plugin/types/index.d.ts,
    plugin/test/engine/pane.test.tsx,
  ]
---

# A Decide item a later one restates is Done, superseded, and each of the two links to the other

The user chose this design in `5b4b0642.Decide.1.A` and `5b4b0642.Decide.2.A`.

- **The agent names what it replaces.** `kanban_options` takes an optional `supersedes` on each item: the references of the earlier Decide items it restates, each `<turn>.Decide.<n>`, such as `["682e71fb.Decide.1"]`. The instructions' fragment for the tool, `spec/fragments/tool.md`, teaches it: an item that restates an earlier turn's item, after a question about it or with its options rewritten, names that item.
- **What doesn't parse is ignored, and said.** A value that names no Decide item, `Decide.1`, `682e71fb.Todo.1` or one that isn't a string, is dropped from the item, and the tool's result names each, by the item's ref. A `supersedes` that's no list, or a list none of whose values names an item, counts as left out, so the subject decides, and the result says so; `[]` still supersedes none.
- **Superseded, by the newer item.** A Decide item settles as `superseded`, `by` the newer item's ref, when a later item names it in `supersedes`, the latest such item where several do; else, where the later item gives no `supersedes`, when it's on the same subject, as the subject key reads it. An explicit `supersedes` wins: an item on the subject it doesn't name stays open, and `[]` supersedes none. `HowSettled` holds no ref of its own, so `by` is the only ref it holds.
- **Raised again, listed once.** A later raising of an item's own ref replaces the earlier one, whatever its `supersedes`, so an open item the agent raises again from `kanban_outstanding`'s items, or a turn's second call raises again, is listed once. That JSON leaves `supersedes` out, since what it named is settled already.
- **Only a later item supersedes.** A reference to a later item, to one no turn raised or to the item itself supersedes nothing, so a cycle settles only the older of its items. One item may supersede several.
- **An answer still wins.** An item the user answered settles as answered, and one a later `reassess` turn replaced as reassessed, before any item supersedes it.
- **The inverse.** `supersedesOf` gives, for a raised item, the refs of the raised items it superseded, from each one's `by`.
- **Both ends are links.** A superseded item sits under the Done branch, in its turn's group there, its line `<summary> · Superseded by <ref>`, and its box `Superseded by <ref>`; the newer item's box says `Supersedes <ref>` for each item it superseded. Each is a link: a click opens the pane with the keyboard at the other item, every level it's under opened by `withItemShown` in `src/pane/sections.ts`, its branch, its turn there and, where it's Done, its box, as a question's link does. The boxes under a reply draw the same links. The words come from the settled-text table in `src/pane/view.ts`. A superseded item's settlement gives no letters, so no option's bar lights beside it.
- **A question is never a choice, on Submit too.** An answer whose line asks a question, `Decide.1: how would B work?`, puts the item in neither Queued nor Done: `paneStateOf` leaves it Open while the draft holds the line, and Submit sends it without settling it, so it stays Open until the reply restates it, as the turn's end reads it. The draft's choice for an item is the latest of its answers on a line that asks no question, and the `✏️ N picked` count reads the same.

Checks: unit tests in `plugin/test/unit/` for an explicit `supersedes`, the subject fallback, one item superseding several, a reference that doesn't parse or names a later, unknown or the same item, a cycle, an answer beating a supersedes, the inverse, the tool's result and the question-only Submit; engine tests in `plugin/test/engine/pane.test.tsx` that draw both links in the pane and under a reply, press each to open the other item, and Submit a question-only answer.

The kanban skill, which the plugin's rules shared before `kanban-skill-retired`, doesn't get this rule.
