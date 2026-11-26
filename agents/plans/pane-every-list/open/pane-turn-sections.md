---
title: The pane groups every list's items by state, then turn, then list, each state and turn under a toggle that folds it
state: approved
kind: implementation
part-of: pane-every-list
needs: [items-of-every-list, pane-list-filters, pane-ui-harmonize, pane-state-reducer]
touches: [plugin/hooks/register.tsx, plugin/src/pane/view.ts, plugin/src/pane/sections.ts, plugin/types/index.d.ts, plugin/test/engine/]
---

# The pane groups every list's items by state, then turn, then list, each state and turn under a toggle that folds it

## The hierarchy

The pane's items sit three levels deep: **State → Turn → List**.

1. **State.** Three branches, in this order, each under a toggle counting its items:
   - **Open**, `▾ Open (n)`, expanded at first: every turn with an item that needs the person and that the draft doesn't answer.
   - **Queued**, `▾ Queued (n)`, expanded at first: every turn with an item the draft answers, by a picked option or a note, that hasn't been sent. Undoing an item's last pick puts it back in Open.
   - **Done**, `▸ Done (n)`, collapsed at first: every turn with a Done item, sent or settled otherwise.
2. **Turn.** In each branch, one group per turn with an item in that branch, newest first. Each opens on a faint header that is a toggle, `▾ ── 9efb08a1 ₋₂ (2) ──`: the turn's id, its index counting back from the latest turn, and its item count in that branch. Each starts expanded, and folds that turn's items in its own branch alone.
3. **List.** Within a turn's group in a branch, once every list is shown, the lists come in the spec's order, each under a header with its glyph and name, such as `🧠 Decide`, drawn as faint as the turn's header. A list with no item in the group has no header.

**Why State comes first:** the person's question on opening the pane is what's still open, and the Done items are history, read rarely. With State on top, one click folds every Done item away at once, and the open items read as one block, newest turn first, with nothing settled between them. With Turn on top, each turn carried its own Done toggle, so hiding history took a click per turn, and Done rows sat between the open items of one turn and the next. Each turn still folds on its own, in each branch apart, so a turn of open items can be put away while its Done items stay in sight, and the other way round. A Done section per list, under each turn, would scatter the history further still, one toggle per list per turn.

**Why Queued sits between them:** a picked item has left the person's to-do, so it moves out of Open, and the next open item comes up to where the person is looking; but it isn't sent, so it stays in reach, its box whole and its options live, to change a pick or add a note before Submit.

## Already true for Decide items

The pane draws the State and Turn levels for Decide items: `paneGroups` in `plugin/src/pane/sections.ts` works the branches and turn groups out as pure functions, with their headers, counts and keys, an item's branch a pure function of its raised state and the draft (`paneStateOf`). The header row's `n of m answered` counts Queued among the open items, from the same groups. What the toggles a click moved hold lives in the `folds` atom, apart from `PaneState`: the Done branch and each Done item's box, which start collapsed, by key in `expanded`, and the Open and Queued branches and the turns, which start expanded, by key in `collapsed`.

- **A pick moves the ring on.** A pick that moves the item the ring is on out of Open moves the ring to the next open item's first option the pane shows, else the last one before it, else the item in its new branch. A checkbox item, which takes more than one pick, stays in Open while the ring is on it, and moves to Queued once the ring leaves it.

## What this node adds

- **Every list's items.** A turn's group holds the items of all 9 lists from [items-of-every-list](items-of-every-list.md), not only its Decide items, under their list headers.
- **One outline per turn group in a branch.** A turn's group in a branch, its list headers and item boxes, sits inside one outline, so the turn's items in that branch read as one block; each item's box stays inside it, and the boxes under a reply share the same outline ([list-actions](list-actions.md)). A turn with items in two branches has an outline in each.
- **Lists nothing settles are Done from the start.** The items of a list nothing settles, ✅ Done, 📝 Logged and ❓ Answers, need nothing of the person, so each sits under its turn in the Done branch as soon as it's raised, under its list's header, and keeps its Note button there. Open then holds only items that need the person, so `n of m answered` stays true.
- **Hidden groups aren't drawn.** A list header whose items [the filters](pane-list-filters.md) all hide makes no header and no elements; a turn whose items in a branch they all hide has no header in that branch; and a branch whose items they all hide draws nothing, not even its toggle.

## Rules that hold at every level

- **Keys.** Each toggle has its own key: `open`, `queued` and `done` for the branches, `open.<turn>`, `queued.<turn>` and `done.<turn>` for a turn in each branch; a list header's key adds the list, `done.<turn>.<list>`. ↑ Previous and ↓ Next stop on each toggle and header, and on no item of a folded group. A ring on an element is at the stop with its exact key, else at the stop whose group is the longest prefix of its key, so `done.<turn>.<list>` is found under its turn, not under `done`. [pane-turn-navigation](pane-turn-navigation.md) scrolls to a turn's header, in the branch it names.
- **Moves change no fold.** An item moving between branches, by a pick, an unpick, Submit or a refresh, changes only the counts: every toggle stays as the person left it, and a turn new to a branch starts at its default. An item that moves into a turn the person folded in that branch stays hidden there, counted in its header; this is intended, so that the pane doesn't scroll under the person while they pick.
- **Showing an item opens its levels.** What scrolls to an item, a question's link, `✏️ Add a note` or `/answers`, opens every level the item is under first: its branch, its turn in that branch and, for a Done item, the item's box.
- **The groups are pure.** The grouping, the headers' text, the counts and the keys come from pure functions of the items, the draft, the visibility predicate and the folds, in `plugin/src/pane/sections.ts`; the hooks only map them.

Checks: tests in `plugin/test/unit/` for the grouping by state, turn and list, the list headers, and that every raised item is in exactly one branch, under its own turn; engine tests in `plugin/test/engine/` that read the groups' order with items of several lists in one turn, fold one turn under one branch while the same turn under the others stays as it was, and draw a ✅ Done, 📝 Logged or ❓ Answers item in the Done branch from the moment it's raised, its Note button live.
