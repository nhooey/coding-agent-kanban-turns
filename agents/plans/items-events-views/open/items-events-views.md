---
title: Items are one type changed only by events, and every view is a pure function of them and the view state
state: approved
kind: end-state
---

# Items are one type changed only by events, and every view is a pure function of them and the view state

The design this plan rests on, with the person's decisions and later rules, is the report [The ideal work model for the kanban mod](../../../reports/2026-11-27-ideal-work-model.md).
It builds on [items-events-views-refactor](../../items-events-views-refactor/open/items-events-views-refactor.md), the plan that clears the code first: one module per layer with imports one way, effects only in the hooks, and nothing kept for what came before or left unused.

With the coding-agent-kanban-turns plugin loaded:

- **One item type.**
  Everything one actor owes another in a session is an item, with the same fields whatever it's about (`64b1cbcd.Decide.1.A`):
  - a kind, `task` (something to do) or `question` (something to answer);
  - `raised-by`, the actor who created it, and `owner`, the actor whose move it is;
  - a state, `open`, `active` or `closed`;
  - a resolution, present exactly when the state is `closed`.

  Decision, approval and review are presets, named bundles of defaults in the spec, never kinds.
  The 9 lists aren't types: each is a filter over those fields, and so is every section, count and roll-up.
- **Changed only by events.**
  An item changes only by an event, `{verb, item, by, in, at, args, evidence}`, from one of 3 sources: the agent, through the item tool; the person, through a control or a reference in their own text; and the harness or a tracker, as an observation.
  The item tool is the source of truth for the agent's events: it checks each against the transition table and refuses an illegal one with the reason.
- **The log is the transcript.**
  The events are read from the session's transcript, with no store beside it, so a rewind, a fork or a resume moves the items with the conversation (`64b1cbcd.Decide.3.A`).
- **Session scope, ordinal ids.**
  An item's id is its ordinal in the session's log, `#12`, which never encodes its kind, owner or state, so it survives a change of any of them; it's answered as `12.B`.
  Work that outlives the session is resolved as `transferred`, with a link to an issue or a plan node.
- **Both outputs.**
  The agent's reply refers to the items by id in its prose, each reference a link to the item, and the pane shows the same items structured (`64b1cbcd.Decide.2`).
  The prose holds no item data of its own: what is drawn at a reference comes from the events ([reply-refers-to-items](reply-refers-to-items.md)).
- **Every view is a pure function of the items and the view state.**
  That covers a reply's references and the cards under it, a turn's digest, the pane's tree and the count line.
  The view state is the facet order, which nodes are folded, the draft and the focus, and holds no item data.
- **The pane's tree is a group-by.**
  It groups the items by facets in an order the person sets: each level is one facet, each node one value, and every node a toggle.
  A facet is any item field or derived field, such as owner, state, kind, preset, turn, urgency or blocked.
  Each item's controls come from the transition table.
- **A press is an event, and moves the item.**
  Every control the person presses fires an event the fold's one transition function applies at once: the item's state changes in every view, and the tree draws it under the node its new state belongs in.
  Every node whose path still exists keeps its fold.
- **Queued is the draft's text, read.**
  Between a press and Submit an item is queued: it shows in its new place, marked queued.
  What is queued is the parse of the prompt draft's text, by the one reference grammar, on every change to it, and is stored nowhere else.
  A press writes a line into the draft, and a hand edit counts as a press does: deleting a queued pick returns its item to open.
  Submit cements what the submitted prompt's text holds, scanned then, and never what was pressed.
- **A reassess holds what it covers.**
  A submitted `reassess` is an event, and closes the pane while its turn runs.
  Every item it covers is being reassessed, a condition derived from that event and never a stored state: drawn dim under one folded node, with no controls, so nothing old asks for action.
  When the turn ends with its final response, each item is open again, kept or raised again, or closed as `withdrawn`, and the pane comes back only if something awaits the person; a turn that's interrupted leaves no item held ([reassess-holds-items-until-done](reassess-holds-items-until-done.md)).
- **The UI mirrors the data.**
  No view model reshapes the items between the fold and the drawing: a tree node is a filter over items, a card is an item's fields, and a control is a transition.
- **The rules are data.**
  Kinds, presets, states, outcomes, events and who may fire them, relations, facets and controls are entries in `plugin/spec/kanban.yaml`.
  Adding or renaming a kind or a state is a spec edit, and no code compares any of their names.
- **What's special is named, with its reason.**
  Three things are drawn or ordered differently from the rest, and the spec names each and says why: a question's options, because each is a target of its own; items that block the agent, because they cost the most to leave; and items being reassessed, because none needs action until the reassess is complete.
  Nothing else is.
- **The architecture it's built on still holds.**
  Each part of the model lands in its layer, and [the refactor plan](../../items-events-views-refactor/open/items-events-views-refactor.md)'s end state is as true after the model as before it.
- **Nothing is kept for the lists.**
  The plugin has one user, so the cut-over leaves no reader of an older reply or reference, no importer of an earlier session and no fallback to the lists.

## The item

```yaml
id: 12 # the session ordinal, in log order
kind: question # task | question
preset: decision # optional: decision | approval | review
summary: Which loader to keep
body: Both are built; this picks the default.
raised-by: agent:main # an actor: user, agent:<id> or external:<name>
raised-in: 0f311c94 # the turn
owner: user
state: open # open | active | closed
resolution: null # {outcome, payload, by, in, evidence}, exactly when closed
response: # questions only: the shape of a valid answer
  picks: one # one | any | text
  options: [{ letter: A, name: Keep the fast loader, pros: [], cons: [] }]
  default: null # the option the raiser may assume
urgency: turn-end # now | turn-end
refused: null # approvals only: the refused call's exact text, which the approval gates
links:
  - { rel: blocked-by, to: "item:9" }
  - { rel: about, to: "github:nhooey/coding-agent-kanban-turns#49" }
```

An item never copies the state of a harness entity or an artefact: it links to it, and the link's target is read live.
`blocked`, `ready`, `stale` and `new` are derived from the items and their links, never stored.
`queued` and `reassessing` are derived too, from the pending events and the reassess turn's status.
A picked answer that isn't sent is no item state: it's a line of the draft's text, which parses to a pending event.

## Checks

- **The rules are data.**
  - A search of `plugin/src/`, `plugin/hooks/` and `plugin/cli/` finds no kind, preset, state, outcome, verb or facet name outside the module the spec compiles to.
  - A test compiles a fixture spec whose kinds, states and verbs have other names, with a kind and a state added, and the fold, the renderer and the tree run on it with no code changed.
- **Every view is pure.**
  Each view's function in `plugin/src/` takes the items and the view state and nothing else, and no hook draws from any other value.
  A property test over random logs and view states finds each view the same for the same inputs.
- **The view state holds no item data.**
  Its type holds item ids, facet names, node keys and the draft's text alone.
- **The tree is generic.**
  A property test over random items and random facet orders finds every item exactly once, under the node whose path holds its value for each facet in the order.
  A reorder keeps the fold of every node whose filter still exists.
- **No view model.**
  `plugin/types/index.d.ts` holds one item type and no type that copies an item's fields under another name; the renderer and the tree take `Item` values.
- **One control per transition.**
  A property test over random items finds each item's controls equal to the transitions the person may fire on it, one control each.
- **One shape for every control.**
  Every item's controls, a task's Done, Skip and note and a question's options alike, are drawn one to a line, each line opening on its emoji.
  A property test over random items of every kind finds each control alone on its line behind its emoji, and a test finds one layout function for a control, which takes the control and no item, kind or preset, so no kind has a layout of its own.
- **What's special is named.**
  The spec's schema refuses a `special` entry with no `reason`, and a test finds the renderer's and the tree's special cases equal to the spec's `special` entries, by name: `options`, `blocks-agent` and `reassessing`, and no fourth.
- **The fold replays.**
  Folding a log from empty gives the same items every time; an item is closed exactly when it has a resolution; and `blocked-by` and `supersedes` hold no cycle.
- **A press moves the item.**
  - A property test over random items, facet orders, folds and presses finds, after each press, the pressed item under the node whose path holds its new value for each facet, no other item moved, and every node whose filter exists before and after with the fold it had.
  - A test finds one transition function: the one that folds the log is the one that applies a press and a queued event.
- **Queued equals the parse of the draft.**
  - A property test over random mixes of presses and hand edits to the draft's text, a line changed, deleted, typed or broken, finds the queued marks always equal to the accepted events of the draft's parse, whatever produced the text.
  - A test finds a queued pick deleted by hand back among the open items, with its controls.
  - A property test finds the events a Submit cements equal to the parse of the text it sent, whatever was pressed before.
  - The view state's type has no field for a pick: the draft's text is the only place one is held.
- **A reassess holds, then lets go.**
  - A property test over random logs finds no item `reassessing` once its reassess's turn has ended, however it ended, and no stored state by that name in the spec.
  - Tests find a completed reassess closing exactly the covered items its turn neither kept, raised again nor resolved, and a lapsed one changing no item its turn's own events didn't.
  - A test finds no control drawn for an item being reassessed, in the pane, under a reply or at a reference.
  - In a live session, a submitted `reassess` closes the pane and the count line reads `reassessing`; the pane reopens when the turn's final response lands, only if an item awaits the person; and an interrupted reassess leaves the items open, with the pane saying how many weren't reassessed.
- **A command runs where the agent sees it.**
  Tests find an item's command drawn as one control that fills the prompt draft with `! <cmd>`, and, for a command that must run in another shell, the wrapper's status lines and log file and a Started control that fires `start`.
  An item for a refused action also draws a grant, whose fill holds the refused command byte for byte ([commands-run-where-the-agent-sees](commands-run-where-the-agent-sees.md)).
- **A task whose command has run, or whose target is already in place, is closed without the person writing `done`.**
  Tests find a `!` command's bash output, followed by the agent's `resolve`, closing its item, and an item whose target is already in place resolved with no run; in a live session, a task whose command the person ran doesn't show as open in the next turn.
- **The architecture still holds.**
  [The refactor plan](../../items-events-views-refactor/open/items-events-views-refactor.md)'s checks pass with the model built, and its unused-exports check lists no exception.
- **Nothing is kept for the lists.**
  A search of `plugin/` finds no reader of an older reply's or reference's form, no importer of an earlier session, and no setting, warning or branch that exists only for a session begun before the cut-over.
- **In a live session,** an item the agent raises through the tool shows in the reply at its reference, in the pane and in the count line; an answer from a control or typed as `12.B` closes it in all three; and a rewind to before the raise removes it from all three.
- **The repository's checks pass,** `typecheck-plugin` and `plugin-test` among them.

## Its parts

Three checks of the model come first, each cheap, and each can change the model before anything is built on it:

1. [lists-fit-filter-table](../closed/lists-fit-filter-table.md): every item in the fixture transcripts fits one row of the filter table.
2. [list-moves-fit-transitions](../closed/list-moves-fit-transitions.md): every move between lists is one event of the transition table.
3. [task-list-matches-pending](../closed/task-list-matches-pending.md): whether the agent's Pending items are the harness's task list.

Beside them, [the refactor plan](../../items-events-views-refactor/open/items-events-views-refactor.md)'s five nodes clear the ground the model is built on, and need no answer from the checks.
This plan's nodes wait on them across the two plans:

- [item-model-in-spec](item-model-in-spec.md) on [compatibility-code-deleted](../../items-events-views-refactor/closed/compatibility-code-deleted.md);
- [item-event-reducer](item-event-reducer.md) on [core-folders-are-layers](../../items-events-views-refactor/open/core-folders-are-layers.md);
- [item-tool-declares-events](item-tool-declares-events.md) and [item-renderer-densities](item-renderer-densities.md) on [hooks-split-by-concern](../../items-events-views-refactor/open/hooks-split-by-concern.md);
- [reply-prose-readers-retired](reply-prose-readers-retired.md) on [unused-exports-checked](../../items-events-views-refactor/open/unused-exports-checked.md).

What is better refactored by the node that rewrites it is named there, under **Refactored as it goes**: the spec's build step by section in [item-model-in-spec](item-model-in-spec.md), the pane's state module in [pane-view-state](pane-view-state.md), and the `gh` reader's move to the artefacts layer in [harness-observations-as-events](harness-observations-as-events.md).
The 1,100 lines of settlers in `items/outstanding.ts` aren't tidied at all: [reply-prose-readers-retired](reply-prose-readers-retired.md) deletes them.

Then, each `needs` the ones it builds on:

- [item-model-in-spec](item-model-in-spec.md): the spec's schema for kinds, states, events and facets.
- [item-event-reducer](item-event-reducer.md): the fold over the log.
- [item-tool-declares-events](item-tool-declares-events.md): the item tool.
- [item-reference-grammar](item-reference-grammar.md): `12.B` and the person's other references.
- [item-renderer-densities](item-renderer-densities.md): the one renderer, at chip, line and card density.
- [pane-view-state](pane-view-state.md): the facet order, the folds, the draft and the focus in the pane's one state.
- [pane-facet-tree](pane-facet-tree.md): the tree, and the count line as its first level.
- [reply-refers-to-items](reply-refers-to-items.md): the prose's links to items.
- [harness-observations-as-events](harness-observations-as-events.md): a shell, a subagent or a pull request as events.
- [reassess-holds-items-until-done](reassess-holds-items-until-done.md): a submitted reassess, and what its items are until its turn ends.
- [reply-prose-readers-retired](reply-prose-readers-retired.md): no reader takes an item from a reply's prose.
- [derived-skill-follows-items](derived-skill-follows-items.md): the derived skill's update.
- [pane-windowed-render](pane-windowed-render.md): the pane draws only what's in or near its scroll window.
- [commands-run-where-the-agent-sees](commands-run-where-the-agent-sees.md): a command the person is asked to run, as a control that fills the prompt with it.

**The 9-list path keeps working until the cut-over.**
Each part up to the tree lands beside the list readers, unreached by the hooks; [pane-facet-tree](pane-facet-tree.md) and [reply-refers-to-items](reply-refers-to-items.md) switch the pane and the reply to items, and [reply-prose-readers-retired](reply-prose-readers-retired.md) deletes the old path.
No pane code is written on the list model in the meantime (`64b1cbcd.Decide.4.A`).

## What this plan takes in

Each node below is superseded by the part that holds what it described:

| Node                                                                                                    | Superseded by                                         | What becomes of it                                                                                         |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [pane-every-list](../../pane-every-list/closed/pane-every-list.md)                                      | this node                                             | every list's items are items, and the lists are filters                                                    |
| [pane-state-reducer](../../pane-every-list/closed/pane-state-reducer.md)                                | [pane-view-state](pane-view-state.md)                 | Submit, the refresh and the settings are in `PaneState`; the pane's own fields and the draft move as view state |
| [pane-submit-moves-to-done](../../pane-every-list/closed/pane-submit-moves-to-done.md)                  | [pane-view-state](pane-view-state.md)                 | a sent answer is a pending event folded ahead of the transcript's read                                     |
| [items-of-every-list](../../pane-every-list/closed/items-of-every-list.md)                              | [item-event-reducer](item-event-reducer.md)           | items come from the fold, never from a reply's lists                                                       |
| [kanban-skill-list-answers](../../pane-every-list/closed/kanban-skill-list-answers.md)                  | [item-reference-grammar](item-reference-grammar.md)   | a settling word is the word of a transition the person may fire                                            |
| [answers-grouped-by-turn-and-list](../../pane-every-list/closed/answers-grouped-by-turn-and-list.md)    | [item-reference-grammar](item-reference-grammar.md)   | one line per item, its context in parentheses kept                                                         |
| [list-actions](../../pane-every-list/closed/list-actions.md)                                            | [item-renderer-densities](item-renderer-densities.md) | a card's controls come from the transition table                                                           |
| [pane-turn-sections](../../pane-every-list/closed/pane-turn-sections.md)                                | [pane-facet-tree](pane-facet-tree.md)                 | state and turn are 2 facets among several                                                                  |
| [pane-decide-filters](../../pane-every-list/closed/pane-decide-filters.md)                              | [pane-facet-tree](pane-facet-tree.md)                 | a filter that's off is a folded node, which shows its count                                                |
| [pane-list-filters](../../pane-every-list/closed/pane-list-filters.md)                                  | [pane-facet-tree](pane-facet-tree.md)                 | the same, for every facet                                                                                  |
| [pane-turn-navigation](../../pane-every-list/closed/pane-turn-navigation.md)                            | [pane-facet-tree](pane-facet-tree.md)                 | a jump goes to the next node at the focused node's level, whatever its facet                               |

Re-parented here, with its window over the tree's nodes: [pane-windowed-render](pane-windowed-render.md), which waits on the tree.

Left as they are:

- [pane-controls-stay-visible](../../open/pane-controls-stay-visible.md), which waits on an engine feature and holds for any pane.
- [kanban-skill-retired](../../plugin-sole-source/open/kanban-skill-retired.md), which retires the old skill whatever the protocol is.
- The [kanban-next-chunk](../../kanban-next-chunk/open/kanban-next-chunk.md) plan, which is proposed.
  Its open items are the fold's items, what an item frees is the inverse of `blocked-by`, and a picker's answer is an observation, so [mod-open-items-state](../../kanban-next-chunk/open/mod-open-items-state.md) waits on the fold and [mod-draws-item-links](../../kanban-next-chunk/open/mod-draws-item-links.md) on the renderer.

Already built, and closed as implemented: [decide-superseded](../../pane-every-list/closed/decide-superseded.md), whose rule the fold's `supersedes` relation carries on.

## What changes for the person

The superseded nodes held designs the person had approved.
This plan keeps what has a generic form and drops the rest:

| Approved before                                                                       | In this plan                                                                                                          |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| References `<turn>.<List>.<n>`, answers grouped by turn and list                      | `<n>`, one line per item; the context in parentheses stays                                                            |
| Three branches, Open, Queued and Done, then turn, then list                           | The facets in the person's order, by default owner, then state, then turn; a queued item is drawn where its answer will put it, marked queued |
| A filter row: a toggle per list and per state, **Set default** and **Reset**          | Folding a node; the facet order and the folds each node starts with are kept per user                                 |
| **Only show this turn**                                                               | No control of its own: the turn facet moved first, with the other turns folded                                        |
| ◀ and ▶ by turn                                                                       | A jump to the next node at the focused node's level                                                                   |
| Each list's own actions: Reviewed, Merge it, Skip, Stop waiting, Allow, Deny          | One control per transition, each a line that opens on its emoji: Done, Skip, Hand over and a note on a task, the options on a question; no **Merge it** |
| One outline round a turn's boxes                                                      | No outline: a turn is a node where the turn facet is in the order                                                     |
| The 9 lists and the 📌 roll-up written in the reply                                   | Prose that refers to items by id, the cards of the ones that await the person, and the count line above the prompt    |
| ✅ Done, 📝 Logged and ❓ Answers items in the pane, each with a Note button          | Closed items under their node; an answer to the person's question is prose, and an item only when it can't be answered that turn |
| A session's earlier replies still read after a change of format                       | Nothing from before the cut-over is shown; the agent raises what's still open on the next `reassess`                  |

## Open questions

Each has a recommendation, and the node it changes waits on the answer.

| #   | Question                                                                 | Options                                                                                                             | Recommendation                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | How do the prose and the events stay consistent?                         | The prose restates items and a lint checks it; the plugin renders the items and the prose names none; the prose refers by id | The prose refers by id, what's drawn at a reference is rendered from the events, and the turn's end checks only that each reference names an item. [reply-refers-to-items](reply-refers-to-items.md) weighs the three. |
| 2   | How does a reference in prose differ from a GitHub `#12`?                | A bare `#12`; a Markdown link the tool's result gives; another sigil                                                 | A bare `#12`, read as an item only when the log holds item 12 and it stands outside a link, a code span and `owner/repo#12`. The instructions have the agent name a pull request by a link or with its repository. |
| 3   | Where is a turn's digest drawn?                                          | On the item tool's row; under the reply                                                                             | Both, by one rule each: the tool's row draws its own call's events as lines, and the reply draws, under its text, the card of each item it refers to that awaits the person.                                |
| 4   | Where do observations live that the transcript doesn't hold, such as a merged pull request? | A second log in the plugin's store; read live at each refresh                                    | Read live, as a second input to the fold. A tracker's closed states never reopen, so a replay gives the same items, and no second log can drift from the first.                                             |
| 5   | Are the agent's own tasks the harness's task list or raised through the tool? | Project `TaskCreate` and `TaskUpdate`; raise them through the tool                                              | Raise them through the tool, where the model has the task tools and where it doesn't; a `TaskCreate` or `TaskUpdate` call is evidence alone. [task-list-matches-pending](../../../reports/2026-11-27-task-list-matches-pending.md) found the task list held none of the agent's Pending items. |
| 6   | Is a note an event?                                                      | A `note` verb with no state change; words after an id are always an answer                                          | A `note` verb. Words after a question's id answer it, unless the line asks a question; words after a task's id are a note. Which of the two a kind's words are is the kind's entry in the spec.             |
| 7   | How does an answer in plain words, with no reference, become an event?   | The grammar only; the agent records it for the person                                                               | Both, marked by provenance. The agent's `resolve … by user` cites the person's own prompt, which the tool checks exists and is later than the raise; the row says "as the agent read it", and `reopen` undoes it. |
| 8   | Is Queued a branch or a mark?                                            | A mark on the item; a derived facet the order can hold                                                              | Both, and neither stored. The item is drawn in the state its queued event gives it, so it sits where that state belongs under the default order, with the mark; and `queued` is a derived facet the person may put in the order to gather the queued items under one node. It isn't in the default order. |
| 9   | What does a session begun before the cut-over show?                      | An importer that reads its old replies into events; nothing                                                         | Settled by the person's "ignore the status quo, nobody uses this except for me": nothing from before, and no importer. The agent raises what's still open on the next `reassess`.                           |
| 10  | Where does a harness with no plugin tools declare events?                | The CLI keeps a log of its own; the CLI prints each accepted event and the adapter reads the tool result            | The CLI's `item` subcommand checks the event against the transcript's fold and prints it as one marked line of JSON, which the adapter reads from the command's result. The log stays in the transcript.    |
| 11  | Are a blocking question and a deferred one the same thing?               | One model under `urgency`; leave `AskUserQuestion` alone                                                            | One model, 2 deliveries. First only observe `AskUserQuestion`, as a question born closed, so the history is whole; route `urgency: now` through it later.                                                   |
| 12  | Do a subagent's item calls enter the session's log?                      | Yes, as `agent:<id>`; no                                                                                            | No. A subagent is a delegated task the harness already holds, and its report is an observation; only the main loop declares events.                                                                         |
| 13  | Does a finished agent task need the person's acceptance?                 | An `accept` step; none                                                                                              | None. Silence accepts and `reopen` rejects; where acceptance matters, the agent raises a review.                                                                                                            |
| 14  | Does the pane show items the person doesn't own?                         | Yes, folded; no                                                                                                     | Yes, folded. They say why the agent is idle, and cost one line.                                                                                                                                             |
| 15  | Do the dropped controls come back?                                       | **Only show this turn**, **Set default**, **Reset** and **Merge it** as special controls; no                        | No. Each has a generic form in the table above, bar **Merge it**, which the person asks for in words.                                                                                                       |
| 16  | Is "being reassessed" a derived condition or a stored state?             | Derived from the pending reassess event and its turn's status; a state with an event into it and out of it; no condition, with everything withdrawn at Submit | Derived. No event has to end it, so an interrupted turn can't leave an item in it. [reassess-holds-items-until-done](reassess-holds-items-until-done.md) weighs this and the four below.                    |
| 17  | Where are the items being reassessed drawn?                              | Under one folded node ahead of the person's order; in place, dim and without controls                               | One folded node, first, so no node the person reads as theirs heads items they can't act on. It's the third `special` entry.                                                                                |
| 18  | What becomes of the items a lapsed reassess never reached?               | Open again, as they were; withdrawn, as on completion; held until the person reassesses again                       | Open again, with the pane saying how many weren't reassessed. The agent judged none of them, and a held item is a stuck one.                                                                                |
| 19  | Does the pane open by itself when the reassess completes?                | It opens without taking the keyboard, if an item awaits the person; only the count line changes                     | It opens, without the keyboard, only when an item awaits the person. The person closed it by submitting, so its return is the signal that the wait is over.                                                 |
| 20  | Which items does a reassess cover?                                       | Every not-closed item an agent raised through the tool; every not-closed item                                       | Those an agent raised through the tool. A subagent and an externally watched item are observed, and no reassess can judge them.                                                           |
| 21  | How does an item blocked by a peer session in another repository unblock? | A `session:<id>` target whose messages change nothing by themselves; a status read from the peer's words; no target, the item only `about` the peer | Settled by the person (`717d7c65.Decide.1.A`): a `session:<id>` target type in [harness-observations-as-events](harness-observations-as-events.md), with no status source. A peer is no subagent or teammate the engine reads, and a status read from its words would be a guess. Each report from the peer is an `observe`, as the `observe` row of [item-model-in-spec](item-model-in-spec.md)'s transition table has a peer agent's report, which with no watch rule records the report and changes nothing; the agent, reading it, removes the link or resolves the item. |