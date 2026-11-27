---
title: The view state, the facet order, the folded nodes, the draft and the focus, is part of the pane's one state, and only its step function moves it
state: approved
kind: implementation
part-of: items-events-views
needs: [item-event-reducer, item-reference-grammar]
touches: [plugin/src/pane/pane-state.ts, plugin/hooks/register.tsx, plugin/defaults/config.yaml, plugin/types/index.d.ts, plugin/test/unit/pane/, plugin/test/engine/, plugin/test/oracle/, plugin/test/fixtures/]
---

# The view state, the facet order, the folded nodes, the draft and the focus, is part of the pane's one state, and only its step function moves it

The pane's state is one `PaneState` that a pure `step(state, event)` moves, returning its effects as data, for Submit, the transcript refresh and the settings.
Six atoms in `plugin/hooks/register.tsx` are written outside it: `folds`, `focused`, `held`, `isKeysOpen`, `noting` and `draft`.
This node moves them in, in the shape the item model gives them.

- **The view state.**
  `PaneState` holds a `view` of 4 parts, and every view reads the items and this alone:
  - **the order:** the facets the tree groups by, first to last;
  - **the folds:** the nodes whose toggle the person moved, each with the state they left it in;
  - **the draft:** the prompt box's text;
  - **the focus:** the node or the item's control the ring is on, and whether the keys panel is open.
- **It holds no item data.**
  The view names facets by their spec names, items by their ids and nodes by their keys.
  No summary, state, owner or option is copied into it.
- **A node's key is its filter.**
  A node is the set of facet and value pairs on its path, `{owner: user, state: open}`, and that set, in no order, is its key.
  A reorder of the facets keeps the fold of every node whose filter still exists, and an item moving between nodes changes only their counts.
- **The draft's text is the pending-event layer.**
  What is queued is `eventsOf(draft)`, the prompt box's text parsed by [the grammar](item-reference-grammar.md)'s one parser, on every change to that text.
  Nothing is stored on a click, and no second copy of the picks is kept: there is the text, and its parse.
- **A press writes a line.**
  A control's press is an event to `step`, which returns one effect, fill the prompt with `withEvent(draft, event)`; the prompt's change comes back as the draft, and the parse of the new text is what's queued.
  A second press takes the line out the same way.
- **A hand edit counts as a press does.**
  The person may edit the draft in the prompt box, and the pane can't tell an edited line from a written one, nor needs to.
  A line changed by hand, `12.B` to `12.A`, changes the item's queued mark and its place in the tree at once; a line deleted returns its item to where the log has it, open and outstanding; a line typed by hand queues its item as a press would.
  A line that no longer parses is the person's prose and queues nothing; a line that parses and that the fold refuses, such as an option the question doesn't have, queues nothing and the footer names it.
- **The items every view draws are projected.**
  They are [the fold](item-event-reducer.md)'s `project` over the transcript's items, with the sent events and then the draft's events as pending: the items as they will be.
  So a press changes the item's state in every view at once, and the tree moves it to the node its new state belongs in, marked queued until it's sent.
  Each view also has the items as the log alone has them, for the controls: a queued item keeps the controls it had, so its pick can be changed or taken back with one press.
- **Submit cements what the prompt holds.**
  On Submit, `step` scans the text it sends, `eventsOf(submitted)`, and keeps those events as sent; it never reads the presses.
  Only what is in the prompt at that moment becomes events: a pick deleted by hand before Submit is no event, and its item stays outstanding.
  The same holds for a prompt the person sends with Enter, which the adapter scans from the transcript as it scans every prompt of theirs.
- **Sent events are dropped by the read.**
  The transcript read that holds the prompt drops the sent events it finds in the log, and a prompt the engine refuses drops them all, which puts the items back.
  No item is marked sent and no ref is held: the projection is the same `step`, over a longer list.
- **The order is the person's.**
  It starts from `pane.facets` in `plugin/defaults/config.yaml`, is changed from the pane itself with no reload, and is kept in the plugin's `$.store` across sessions on the machine.
  The folds each node starts with are a setting beside it, `pane.folded`, a list of filters.
- **Every change is an event.**
  A toggle, a facet moved up or down, added or taken out, the ring moving, the keys panel, a control's press and the prompt's change are each an `Event` of the one union, and `register.tsx` has no `update` of the pane's state outside `dispatch`.
  The atoms `folds`, `focused`, `held`, `isKeysOpen`, `noting` and `draft` are gone.

**Refactored as it goes:** `plugin/src/views/pane-state.ts` is one module of 900 lines; as each atom moves in, the state's parts, Submit, the refresh, the settings and the view, become a module each, with `step` composing their steps, so a part is read and tested alone.

Checks:

- `plugin/test/unit/views/pane-state.test.ts` drives `step` through: a control pressed and unpressed; a queued line changed by hand, deleted by hand and typed by hand; a Submit sent, then read; a Submit after a pick was deleted by hand, which sends no event for it; a Submit refused; a facet moved, with a folded node whose filter survives and one whose filter doesn't; the ring moving past a folded node;
- a property test over random mixes of presses and edits to the draft's text that the queued marks always equal the accepted events of `eventsOf(draft)`, whatever produced the text, and that the projected items equal the fold of the log with those events after it;
- a property test that the events Submit keeps as sent equal `eventsOf` of the text it sent, whatever was pressed before;
- a property test over random event sequences that the view never names an item the log doesn't hold after the next read, that the sent events are empty once a read holds their prompt, and that a reorder changes no fold whose filter exists before and after;
- a type-level test that `view` holds strings, numbers and booleans alone, no `Item`;
- while each atom moves, a differential test drives the old handlers and `step` through the same random sequences, with every difference classed in the commit message as a fix or a race made unreachable, and goes once the last has moved;
- the engine tests in `plugin/test/engine/` pass, and `typecheck-plugin` and `plugin-test` pass in the dev shell.
