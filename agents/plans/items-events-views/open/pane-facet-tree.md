---
title: The pane is a group-by tree over facets in the order the person sets, each level one facet and each node one value, and the count line is its first level
state: proposed
kind: implementation
part-of: items-events-views
needs: [item-renderer-densities, pane-view-state, item-tool-declares-events]
touches: [plugin/src/pane/, plugin/hooks/register.tsx, plugin/defaults/config.yaml, plugin/src/config/config.ts, plugin/types/index.d.ts, plugin/test/unit/pane/, plugin/test/engine/, README.md, AGENTS.md]
---

# The pane is a group-by tree over facets in the order the person sets, each level one facet and each node one value, and the count line is its first level

```text
╭ Board · you 2 · agent 2 · external 1 ─────────── k ↑  j ↓  h ?  q ✖ ╮
│ ▾ Yours (2)                                                         │
│   ○ ? #12 Which loader to keep                  0f311c94 · frees #14│
│       Both are built; this only picks the default.                  │
│       ✅ A  Keep the fast loader: it survives restarts              │
│             ➕ faster cold starts                                   │
│             ➖ disk use                                             │
│       🔘 B  Keep the small loader: simpler                          │
│       ✏️ Answer in words                                            │
│   ○ ☐ #13 Review PR #49 "Read the protocol's rules…"       0f311c94 │
│       PR open, checks passing; closes when it merges                │
│       ✅ Done                                                       │
│       🚫 Skip                                                       │
│       ↪️ To agent                                                   │
│       ✏️ Add a note                                                 │
│ ▸ Agent's (2)    ◐ #11 Rebase the stack · ○ #14 blocked by #12      │
│ ▸ External (1)   ○ #15 CI on PR #49 · running 4m                    │
│ ▸ Closed (14)                                                       │
│                                                                     │
│ Draft: 12.A                                r ↺ Reassess  s ⏎ Submit │
╰─────────────────────────────────────────────────────────────────────╯
```

- **One function builds the tree.**
  `tree(items, order)` groups the items by the first facet in the order, each group by the next, and so on: a level is one facet, a node is one of its values, and a node holds its count and either its child nodes or, at the last level, its items.
  It reads each facet from the spec, the field or derived field it's over, the order of its values and their labels, and has no code for any one facet.
  A facet added to the spec groups the tree with no code changed.
- **The order is the person's.**
  The facets group the tree from first to last as [the view state](pane-view-state.md) holds them, by default owner, then state, then turn.
  A control in the pane's header lists the facets in order, and moves one up or down, adds one or takes one out; the tree redraws at once, with no reload, and the order is kept for the next session.
- **Every node is a toggle.**
  An open node draws its children; a folded one draws its count and one line of its items as chips, and nothing under it makes an element or takes layout.
  The folds a node starts with are the `pane.folded` setting: by default the person's open items are open, and the agent's, the external ones and the closed ones folded.
  A node with no item isn't drawn.
- **A press moves the item to its new home.**
  The tree is built over the projected items, the log's with the sent and the draft's events stepped onto them ([pane-view-state](pane-view-state.md)).
  So every control the person presses changes its item's state at once, and the item is drawn under the node that state belongs in, marked queued until Submit cements it; a press taken back, or its line deleted from the draft by hand, moves it back.
  The move changes only the counts of the nodes it leaves and enters: every node whose filter still exists keeps its fold, and a node new to the tree starts as `pane.folded` says.
  When the item the ring is on moves, the ring goes to the next item of the node it left, else the one before it, else the node's header.
- **Items being reassessed sit under one node.**
  While a reassess is pending, the items it covers are drawn under one folded node ahead of the person's order, with no control, as [reassess-holds-items-until-done](reassess-holds-items-until-done.md) says and the spec's `special.reassessing` names.
- **Folding is the filter.**
  There is no filter row: a node the person folds is a filter turned off, with its count on it.
- **What an item is drawn as.**
  A card where the person has a control on it and it isn't closed, and a line everywhere else, by [the renderer](item-renderer-densities.md).
  A closed item's line opens to its card on a click, where `reopen` is its control.
- **Order within a node.**
  The items that block the agent first, as the spec's `special.blocks-agent` says, then the newest.
- **The stops are the tree's.**
  `↑ Previous` and `↓ Next` move the ring through the nodes and the items a folded node doesn't hide, in the tree's order.
  A second pair of keys jumps to the next or the previous node at the focused node's level, whatever its facet, which is a jump by turn where the ring is on a turn.
  What scrolls to an item opens every node on its path first.
- **The count line is the first level.**
  The line above the prompt and the pane's header draw the tree's first-level nodes as chips, `Board · you 2 · agent 2 · external 1`, then how many events the draft holds, `✎ 1 queued`.
  It follows the person's order: with state first, it counts by state.
- **The footer** is the draft's summary, from the pending events, then Reassess and Submit.
- **The cut-over.**
  The pane, the count line and `/answers` read the items from [the fold](item-event-reducer.md) of the transcript's log, with [the item tool](item-tool-declares-events.md) raising them.
  The branches, the turn groups and their stops in `plugin/src/pane/sections.ts` are unreached, and [reply-prose-readers-retired](reply-prose-readers-retired.md) deletes them.
- **Pure.**
  The tree, a node's key, the stops and the count line are pure functions of the items and the view state; the hooks only map them.

Checks:

- a property test over random items and random orders that every item is in the tree exactly once, under the node whose path holds its value for each facet of the order, and that each node's count is the items under it;
- a property test that the tree for an order of no facets is the flat list, and that taking a facet out merges exactly the nodes that differed in it;
- unit tests in `plugin/test/unit/pane/` for the stops with folded nodes, the jump at each level, the order within a node, and the count line under two orders;
- a property test over random items, orders, folds and presses that after any press the pressed item is under the node whose path holds its projected value for each facet, that no other item moved, and that every node whose filter exists before and after has the fold it had;
- a facet added to the fixture spec groups the tree with no code changed;
- engine tests in `plugin/test/engine/` that read the default tree, move a facet up and read the new tree with its surviving folds, fold a node and find no element under it, and restart the session and find the order kept;
- `README.md`'s section on the pane and `AGENTS.md`'s line on `pane/` describe the tree.
