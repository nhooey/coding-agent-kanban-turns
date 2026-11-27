---
title: One pure fold over the event log gives the session's items, and refuses an event the transition table doesn't allow
state: approved
kind: implementation
part-of: items-events-views
needs: [item-model-in-spec, core-folders-are-layers]
touches: [plugin/src/items/, plugin/types/index.d.ts, plugin/spec/cases/, plugin/spec/cases/case.schema.yaml, plugin/tools/spec/cases.ts, plugin/cli/neutral.ts, plugin/test/unit/items/, plugin/test/fixtures/]
---

# One pure fold over the event log gives the session's items, and refuses an event the transition table doesn't allow

- **The types.**
  `plugin/types/index.d.ts` holds one `Item` and one `Event`, as [the end state](items-events-views.md) gives them.
  `Item` is a sum over the state's category: an open item has no resolution field and a closed one must have one, so an item closed without saying why can't be built.
  Its kind, preset, state, outcome and verb are the spec's names, typed from the generated module, never a union written by hand.
- **The log.**
  A neutral turn (`Turn`) carries `events`, in the order they happened, and a session's log is its turns' events in turn order.
  The golden cases and the CLI's stdin take the same field.
- **One step.**
  `step(items, event)` returns the items after the event, or the items unchanged with why it's refused: no such item, a state the verb doesn't fire from, an actor without the role, a condition unmet, an outcome the kind doesn't have, a payload of the wrong shape, or a link that would close a cycle.
  It reads the guards and effects from the spec and interprets its primitives, and compares no kind's, state's or verb's name.
- **The fold.**
  `fold(events)` is `step` over the log from no items.
  It's total: a refused event changes nothing and is listed among the refused, so replaying a log gives the same items and the same refusals.
- **Ids.**
  A `raise` the fold accepts takes the next ordinal, from 1, in log order.
  A refused `raise` takes none.
- **Supersedes.**
  A `raise` that carries `supersedes` closes each item it names as `superseded`, its payload the newer item, and only an earlier item can be named.
  `headOf(items, id)` follows the chain to the item that stands for it.
  An event the person addresses to a superseded question applies to its head only when the head's options are letter for letter the same; otherwise it's refused, with the head's id.
- **A question's options never change.**
  No event edits `response`; a changed question is a new item that supersedes the old.
- **Reassess.**
  A `reassess` is the person's event, about the session and no one item.
  At the end of its turn, with a final response, every item it covers that the turn neither raised again, kept nor resolved closes as `withdrawn`, with the reassess prompt as its evidence; a turn that ends with none withdraws nothing.
  [reassess-holds-items-until-done](reassess-holds-items-until-done.md) holds the rule and what the items are meanwhile.
- **Pending events are stepped by the same function.**
  `project(items, pending)` is `step` over the pending events, in order, onto the folded items: the items as they will be once the draft is sent.
  There is one transition function, so a queued answer and a sent one can't be judged differently.
  A pending event the table refuses changes nothing, and is listed among the refused, as in the fold.
- **Queued is derived.**
  An item is `queued` exactly when a pending event names it and `step` accepts that event.
  Nothing about a queued answer is stored on the item or anywhere else: take the event out of the pending list and the item is as the log has it.
- **Derived, never stored.**
  `blocked`, `ready`, `new`, `stale`, `queued` and `reassessing` are pure functions of the items, their links, the link targets' statuses, the pending events and the turn's status, by the spec's `derived` entries.
  What an item frees is the inverse of `blocked-by`.
- **Incremental.**
  Folding the turns added since the last fold onto its items gives the same as folding the whole log.
- **Pure, and unreached.**
  No I/O and no `claude-code` import.
  The hooks keep reading the lists until [pane-facet-tree](pane-facet-tree.md) switches the pane.

## The invariants, each a property test over random event sequences

1. Every item has exactly one kind, one owner and one state.
2. An item is closed exactly when it has a resolution.
3. An agent's `resolve` on an item the person owns is refused, bar `assume` on a question with a `default`, and a resolve that cites the person's own prompt as evidence where open question 7 allows it.
4. `blocked-by` and `supersedes` hold no cycle.
5. A question's options after any sequence are its options at `raise`.
6. The fold of a log equals the fold of the same log again, and the fold of a prefix then its rest.
7. Every id is the count of accepted `raise` events up to and including its own.
8. `project(items, pending)` equals the fold of the log with the pending events after it, and `project(items, [])` is `items`.
9. The queued items are exactly those an accepted pending event names; with a pending event taken out, its item is as the fold alone has it.

Checks:

- the property tests above, in `plugin/test/unit/items/`, with `fast-check`;
- a unit test for each refusal, and for `headOf` over a chain and a fork;
- golden cases in `plugin/spec/cases/`, each a log and the items it folds to, run by the core's tests and through the CLI;
- the fixture spec with other names folds a log written in those names, with no code changed.
