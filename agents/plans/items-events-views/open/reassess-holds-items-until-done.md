---
title: A submitted reassess closes the pane and holds every item it covers as being reassessed until its turn ends, when each comes back open or closes as withdrawn
state: approved
kind: implementation
part-of: items-events-views
needs: [pane-facet-tree, item-tool-declares-events]
touches: [plugin/spec/kanban.yaml, plugin/spec/kanban.schema.yaml, plugin/spec/fragments/, plugin/spec/cases/, plugin/src/items/, plugin/src/pane/, plugin/src/protocol/, plugin/hooks/register.tsx, plugin/defaults/config.yaml, plugin/test/unit/, plugin/test/engine/, README.md]
---

# A submitted reassess closes the pane and holds every item it covers as being reassessed until its turn ends, when each comes back open or closes as withdrawn

A `reassess` asks the agent to work the open items out afresh.
While it does, the items that were open are neither settled nor current: acting on one answers a question the agent may be about to withdraw.
The person must be able to see at a glance that nothing old needs them, and be called back only when the reassess is done.

## The design

**Being reassessed is a derived condition, from the reassess event, and never a state.**
An item keeps its stored state, `open` or `active`, the whole time; `reassessing` is worked out from the log and the turn's status, as `blocked` is from an item's links.
So no event has to put each item into the condition or take it out, and an item can't be left in it: when the reassess is over, however it ended, the condition is false.

- **A reassess is an event in its own right.**
  The person's `reassess`, typed or sent by the pane's Submit, is one event of the log, `by: user`, `in` the turn it opens, its evidence the prompt.
  It's about the session and no one item: the spec's `events` holds it with `scope: session`.
- **What it covers.**
  Every item that isn't closed when the event lands and that an agent raised through the tool.
  An item the harness holds, a projected task or a subagent, and an item an external watch will close aren't covered: their state is observed, and no reassess can judge it.
- **Three outcomes for the reassess, read from its turn.**

  | The reassess is | When                                                                                   | What its items are                                                  |
  | --------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
  | pending         | its turn is running                                                                    | `reassessing`, bar those the turn has already kept or raised again  |
  | complete        | its turn ended with a final response                                                   | each kept or raised again as its event says; the rest `withdrawn`   |
  | lapsed          | its turn ended with none: interrupted, cut off by an error, or refused                 | each kept or raised again as its event says; the rest open, as they were |

  Whether the turn is running is the harness's to say, read live as a link target's status is; that a turn ended, and whether with a final response, is in the transcript.
- **The agent decides each item's fate with events.**
  In the reassess turn the agent reads the board and, for each covered item, fires `keep`, which changes no state and takes it out of `reassessing`; raises it again, a `raise` that supersedes it; resolves it; or leaves it.
  The item tool's result in that turn names the covered items not yet kept or raised again, so the agent sees what its silence withdraws.
- **At the turn's end the fold closes the rest.**
  With a final response, every item still `reassessing` closes as `withdrawn`, its evidence the reassess prompt.
  The rule is the fold's, at the turn's boundary in the log, and no hook fires an event for it.
- **A lapsed reassess withdraws nothing.**
  The agent never got to judge the items it hadn't reached, so they're open again, their controls back, and the pane says `Reassess interrupted: 5 items not reassessed`, with Reassess there to press again.
  A session resumed after an interrupted reassess shows the same, from the transcript alone.

## What the person sees

- **The press, before Submit.**
  Reassess is a control, and its press is an event like any other: the pending `reassess` in the draft shows every item it covers under the Reassessing node at once, marked queued, and a second press puts them back ([pane-view-state](pane-view-state.md)).
- **Submit closes the pane.**
  A Submit whose draft holds a `reassess` closes the pane as it sends, whatever `pane.close-when-all-submitted` says, and gives the keyboard back to the prompt.
  A prompt the engine refuses leaves the pane open and the items as they were.
- **One node, folded, with no controls.**
  While any item is `reassessing`, the tree draws them all under one node ahead of the person's facet order, `▸ ⟳ Reassessing… (7)`, folded.
  Opened, it lists each at line density, dim, with the clause `being reassessed` and no control: the person may fire no transition from a card that isn't drawn.
  The other nodes hold only what the reassess doesn't cover, so `Yours` is empty and isn't drawn.
- **Everywhere else an item is drawn, the same.**
  A reference in an earlier reply is dim and says `being reassessed`, and the card under that reply is its line, with no control.
- **The count line.**
  It's the tree's first level, so it reads `Board · ⟳ reassessing 7`, with no count under `you` to call the person back.
- **Nothing old can be answered by a press.**
  A reference the person types to a `reassessing` item is still theirs to make, and the fold applies it; the pane offers none.
- **The pane comes back when there's something to act on.**
  When the reassess completes, the pane opens by itself, without taking the keyboard, if an item awaits the person, and stays closed if none does; either way the count line shows the new counts.
  It doesn't open while the turn runs, whatever the agent raises on the way.
- **A lapse opens it.**
  A reassess that lapses with an item awaiting the person opens the pane with its message, since the old items need the person after all.

## What's special, and named

`special.reassessing` in the spec: an item a pending reassess covers needs no action until it completes, so it's drawn with no controls, under one node ahead of the person's order.
It's the third and last entry, beside a question's options and the items that block the agent, and the renderer and the tree look it up by its name as they do those.

## Alternatives, each an open question in [the end state](items-events-views.md)

- **A stored state, `reassessing`,** with an event into it and out of it per item (open question 16).
  An interrupted turn then leaves every item in a state only another event can end, which is the stuck case this design can't reach.
- **Withdraw everything at Submit, and let the turn raise again what stands** (open question 16's third way).
  It needs no condition at all, but a kept item loses its id, a typed `12.B` names nothing, and an interrupted turn has withdrawn everything.
- **Leave the items in place, dim and without controls,** with no node of their own (open question 17).
  It needs no entry in `special` for the grouping, but `Yours (2)` still heads items the person can't act on.
- **Withdraw the rest on a lapse too,** or hold them as `reassessing` until the person reassesses again (open question 18).
- **Never open the pane by itself,** and only signal in the count line (open question 19).
- **Cover every item that isn't closed,** the harness's and the external ones among them (open question 20).

Checks:

- unit tests of the fold: a reassess whose turn keeps one item, raises one again and leaves one, read while the turn runs, after its final response, and after it ends with none;
- a property test over random logs that no item is `reassessing` once its reassess's turn has ended, and that a lapsed reassess changes no item its turn's own events didn't;
- a property test that a completed reassess closes exactly the covered items the turn neither kept, raised again nor resolved;
- unit tests of `step`: a Submit holding `reassess` returns the close-pane effect, a refused one doesn't, the turn's end with an item awaiting the person returns the open-pane effect and with none doesn't, and a lapse returns it with its message;
- unit tests of the tree and the count line with a pending reassess: one node first, folded, no control under it, and `reassessing 7` on the line;
- golden cases in `plugin/spec/cases/` for a completed and a lapsed reassess;
- a test that the renderer's and the tree's special-case tables hold `reassessing`;
- engine tests in `plugin/test/engine/` that press Reassess and find the items under the node, marked queued, and back on a second press; submit and find the pane closed and the count line reassessing; end the turn with a kept item and find the pane open with it; and interrupt the turn and find the items open with the message;
- the item tool's engine test reads the unreassessed items from a result in a reassess turn.
