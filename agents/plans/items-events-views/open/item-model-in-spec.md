---
title: The spec holds the item model as data, its kinds, presets, states, outcomes, events and who may fire them, relations, facets, controls and what's special
state: approved
kind: implementation
part-of: items-events-views
needs: [lists-fit-filter-table, list-moves-fit-transitions, compatibility-code-deleted]
touches: [plugin/spec/kanban.yaml, plugin/spec/kanban.schema.yaml, plugin/spec/kanban.json, plugin/src/protocol/spec.ts, plugin/tools/spec/load.ts, plugin/test/unit/protocol/, AGENTS.md]
---

# The spec holds the item model as data, its kinds, presets, states, outcomes, events and who may fire them, relations, facets, controls and what's special

`plugin/spec/kanban.yaml` gains an `item` section that names everything the fold, the tool, the grammar, the renderer and the tree read, so a kind or a state is added or renamed there and nowhere else.
The section sits beside the `lists` it replaces until [reply-prose-readers-retired](reply-prose-readers-retired.md) takes those out.

## What the spec names, and what the code knows

The split that keeps names out of the code: the spec names things, and the code knows only a small closed set of primitives they're built from.

| The spec names                        | Built from the primitives the code knows                                                                                                                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kinds, with their states and outcomes | A set of states and a set of outcomes                                                                                                                                                                                                                                                                              |
| Presets                               | Default field values, and what an item must carry: a list, every one of it, or an `any-of`, any one of it; each a relation, a relation's inverse or an item field                                                                                                                                                  |
| States, with marks                    | A category, `open` or `closed`; a closed state carries a resolution                                                                                                                                                                                                                                                |
| Outcomes                              | A payload shape: `none`, `answer` (letters, words or both), `text`, `link` or `item`                                                                                                                                                                                                                               |
| Events                                | A scope, one item or the session. Guards: the states it fires from, the roles that may fire it, a condition. Effects: create, set a field, add or remove a link, give the items an argument names a link to it, close with an outcome, keep words as a note, keep the item through a reassess, watch a link target |
| Roles                                 | `any`, `owner`, `raiser`, `user`, `observer`: a relation between the event's actor and the item                                                                                                                                                                                                                    |
| Relations                             | The target types a link may name, whether it's acyclic, and its inverse's label                                                                                                                                                                                                                                    |
| Derived fields                        | A predicate over an item, its links and their targets, the pending events and a turn's status                                                                                                                                                                                                                      |
| Facets                                | An item field or derived field, the order of its values, and their labels                                                                                                                                                                                                                                          |
| Controls                              | An event with its arguments, and the word the person types for it; each is drawn as one line that opens on its emoji                                                                                                                                                                                               |
| What's special                        | A name the renderer or the tree looks up, and its reason                                                                                                                                                                                                                                                           |

A primitive is added in code, with a test; everything named is added in the spec.

An approval names what it gates in one of three ways, so its preset requires any one of them:

- an `about` link to a typed target, such as the pull requests a merge token unlocks;
- the items it holds up, which its `raise` carries as `frees` and the fold gives a `blocked-by` link to it, as a `raise`'s `supersedes` closes the item it names;
- the refused call's text, the item field `refused`, which [commands-run-where-the-agent-sees](commands-run-where-the-agent-sees.md) records for an action the harness or a classifier refused.

[The item tool](item-tool-declares-events.md) refuses an approval's `raise` that carries none of the three.

No watch rule closes an approval, since an observation never answers a question: a pull request it's `about` shows its status in the approval's status clause, and the pull request's rule resolves only a review.

## The section's shape

The shape below is the starting point, which the two checks this node `needs` may change:

```yaml
item:
  kinds:
    task:
      glyph: ☐
      states: [open, active, closed]
      outcomes: [done, dropped, failed, transferred, superseded, withdrawn]
      words: note # what the person's bare words after its id are
    question:
      glyph: "?"
      states: [open, closed]
      outcomes: [answered, assumed, withdrawn, superseded]
      words: answer
  presets:
    decision:
      kind: question
      glyph: 🧠
      defaults: { owner: user }
    approval:
      kind: question
      glyph: 🔑
      defaults: { owner: user, response: { picks: one, options: ["Yes", "No"] } }
      requires: { any-of: [about, frees, refused] } # what it gates, as the section above says
    review:
      kind: task
      glyph: 🔍
      defaults: { owner: user }
      requires: [about]
  states:
    open: { mark: ○, category: open }
    active: { mark: ◐, category: open }
    closed: { mark: ●, category: closed }
  outcomes:
    done: { payload: none }
    dropped: { payload: none }
    failed: { payload: text }
    transferred: { payload: link }
    superseded: { payload: item }
    answered: { payload: answer }
    assumed: { payload: answer }
    withdrawn: { payload: none }
  actors: [user, agent, external]
  events:
    raise: { from: [], to: open, by: [any], effects: [create, { link-from: frees, rel: blocked-by }] } # each item its `frees` names gets a `blocked-by` link to the new item
    start: { from: [open], to: active, by: [owner] }
    pause: { from: [active], to: open, by: [owner] }
    assign: { from: [open, active], to: open, by: [owner, raiser, user], effects: [{ set: owner }] }
    resolve: { from: [open, active], to: closed, by: [owner, user, observer], effects: [{ close: outcome }, note] } # note: the words after its word, if any; a question's answer is letters, words or both
    assume: { from: [open], to: closed, by: [raiser], when: has-default, effects: [{ close: assumed }] }
    withdraw: { from: [open, active], to: closed, by: [raiser, user], effects: [{ close: withdrawn }] }
    reopen: { from: [closed], to: open, by: [user, owner], effects: [{ unset: resolution }] }
    link: { from: [open, active], by: [raiser, owner], effects: [link] }
    note: { from: [open, active, closed], by: [any], effects: [note] } # the same effect carries the words of a resolve or a keep
    keep: { from: [open, active], by: [raiser], effects: [keep, note] } # note: the item's progress, if any
    reassess: { scope: session, by: [user], covers: { not: closed, raised-by: agent, watched: false } }
    observe: { from: [open, active], by: [observer], effects: [watch] }
  relations:
    blocked-by: { to: [item, entity, artefact], acyclic: true, inverse: frees }
    supersedes: { to: [item], acyclic: true }
    about: { to: [entity, artefact] }
  derived:
    blocked: { any-link: blocked-by, target: not-closed }
    ready: { state: open, not: blocked }
    new: { raised-in: latest-turn }
    stale: { owner: external, watch: silent }
    watched: { watch: any } # an observer's watch rule may close it
    queued: { pending-event: accepted } # the draft's text holds an event for it
    reassessing: { covered-by: reassess, while: pending, not: kept }
  facets:
    owner: { of: owner, by: class, values: [user, agent, external] }
    state: { of: state }
    kind: { of: kind }
    preset: { of: preset }
    turn: { of: raised-in, order: newest-first }
    urgency: { of: urgency }
    blocked: { of: blocked }
    queued: { of: queued }
  controls:
    done: { event: resolve, args: { outcome: done }, word: done }
    skip: { event: resolve, args: { outcome: dropped }, word: skip }
    hand-over: { event: assign, args: { owner: agent }, word: to agent }
    reopen: { event: reopen, word: reopen }
    note: { event: note, form: words } # typed as `12: words`, with no word of its own
    reassess: { event: reassess, word: reassess } # the event's scope is the session, so it's drawn once, in the footer
  special:
    options:
      reason: each option of a question is a target of its own, so its resolve draws one control per option
    blocks-agent:
      reason: an item that blocks the agent costs the most to leave, so it sorts first in its node
    reassessing:
      reason: an item a pending reassess covers needs no action until it completes, so it has no controls and sits under one node ahead of the person's order
```

The sketch's `controls` don't meet the rule below that every transition the person may fire has one control: `withdraw`, and `start` and `pause` on a task the person owns, have none.
This node gives each a control or narrows who may fire it, as [list-moves-fit-transitions](../closed/list-moves-fit-transitions.md) finds the transcripts need.

## The transition table

The `events` above are this table, which [list-moves-fit-transitions](../closed/list-moves-fit-transitions.md) tests:

| Verb       | From → to                 | Who may fire it                                          | Notes                                                                                                                                                                                                                                                                              |
| ---------- | ------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `raise`    | nothing → open            | any actor                                                | May carry `supersedes`, which closes the older item as `superseded`, and `frees`, the items it holds up, each of which the fold gives a `blocked-by` link to it                                                                                                                    |
| `start`    | open → active             | owner                                                    | Only a kind with an `active` state, so tasks                                                                                                                                                                                                                                       |
| `pause`    | active → open             | owner                                                    | The same                                                                                                                                                                                                                                                                           |
| `assign`   | open or active → open     | owner, raiser, user                                      | Sets `owner`                                                                                                                                                                                                                                                                       |
| `resolve`  | open or active → closed   | owner; user always; an observer through a watch          | Carries one of the kind's outcomes and its payload, and the words after its word as a note, so `done: rotated it` is one event; a question's answer is its letters, words or both, whatever its `picks`                                                                            |
| `assume`   | open → closed (`assumed`) | raiser, only when the question has a `default`           | The agent goes on with the default; the person may reopen                                                                                                                                                                                                                          |
| `withdraw` | open or active → closed   | raiser, user                                             | Outcome `withdrawn`, which a task's outcomes hold as a question's do, since a reassess withdraws tasks too                                                                                                                                                                         |
| `reopen`   | closed → open             | user on anything; an agent on tasks it owns              | An agent never reopens a question the person answered; it raises another                                                                                                                                                                                                           |
| `link`     | no state change           | raiser, owner                                            | Adds or removes `blocked-by` or `about`                                                                                                                                                                                                                                            |
| `note`     | no state change           | any actor                                                | Words kept on the item; rests on open question 6 in [the end state](items-events-views.md); the words a `resolve` or a `keep` carries are kept the same way                                                                                                                        |
| `keep`     | no state change           | raiser                                                   | In a reassess turn, takes the item out of `reassessing`, so the turn's end doesn't withdraw it; the item's progress rides on it as a note, so a restatement with a new body is one event                                                                                           |
| `reassess` | none, of itself           | user                                                     | About the session, not one item; it covers the items an agent raised that aren't closed and that no watch will close (open question 20 in [the end state](items-events-views.md)); what it does to them is [reassess-holds-items-until-done](reassess-holds-items-until-done.md)'s |
| `observe`  | no state change by itself | the harness, the plugin's poll, or a peer agent's report | Records a link target's status; a watch rule may turn it into `resolve`                                                                                                                                                                                                            |

## What the build step holds the section to

Beyond its JSON Schema, `spec-build` refuses a section where:

- a kind names a state or an outcome the section doesn't define, or an outcome belongs to no kind;
- a state of a kind is reachable by no event, or a closed state has no event into it;
- a preset names no kind, or sets a field the item doesn't have;
- a preset's `requires`, or an entry of its `any-of`, names no relation, no relation's inverse and no item field;
- an event's `link-from` names an argument the event doesn't take, or a relation whose targets don't include an item;
- an event names a role, a condition or an effect outside the primitives;
- an event closes an item with an outcome the item's kind doesn't hold;
- a control names no event, gives an argument the event doesn't take, or shares its word with another control or a command;
- a transition the `user` role may fire has no control, or has two, a question's options aside, which `special.options` covers;
- a facet names no item field and no derived field;
- a `special` entry has no `reason`.

**Refactored as it goes:** the build step's consistency rules in `plugin/tools/spec/load.ts` are one function per section of the spec, each with its own test, so the `item` section's rules join as one more and the `lists` section's leave as one.

Checks:

- the build step's tests in `plugin/test/unit/protocol/` refuse each of those, one fixture each;
- the generated module and the JSON copy are up to date, as `checks.spec` holds them;
- the fixture spec [the end state](items-events-views.md)'s check compiles, with other names and a kind and a state added, passes the build step;
- `AGENTS.md`'s line on what the spec holds names the `item` section.
