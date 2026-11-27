---
title: Every move of an item between lists in the fixture transcripts is one event of the transition table, or a report names the verb it lacks
state: implemented
kind: implementation
part-of: items-events-views
touches: [agents/reports/, plugin/spec/cases/, plugin/test/fixtures/]
implemented-by: items-events-views-build
---

# Every move of an item between lists in the fixture transcripts is one event of the transition table, or a report names the verb it lacks

The model says an item moving between lists is an unnamed event: Todo to Pending is `assign`, Pending to Done is `resolve`, and a Decide item that leaves is a `resolve` by the person.
This check names the event behind every such move in real transcripts, against the transition table in [item-model-in-spec](../open/item-model-in-spec.md), before that node writes the table into the spec.
It writes no code.

## What it does

- **The transcripts.**
  The same as [lists-fit-filter-table](../open/lists-fit-filter-table.md) reads: the golden cases and the fixtures' transcripts, with a live session's read for counts alone.
- **The moves.**
  For each pair of consecutive turns in which an item, matched by its subject, is in a different list, has left every list, or is settled by the person's text, a report or a merged pull request, the check names the verb, who fired it and the evidence the transcript holds for it.
- **The finding.**
  A move with one verb whose guard the transcript satisfies confirms the table.
  A move with no verb, with two, or by an actor the table doesn't allow is a misfit.

## What to look at first

The table's rows for these are the least tested, and the transcripts show each:

- **A note.**
  `Todo.3: after the deploy` changes no state, and the table gives it `note` (open question 6 in [the end state](../open/items-events-views.md)).
- **Keeping an item through `reassess`.**
  A `reassess` turn closes every item the agent raised that it neither raised again nor kept.
  The table gives "kept" the verb `keep`, and the transcripts say how often a reassess reply restates an item unchanged, which is what `keep` stands for.
- **The settling words.**
  `done` and `skip` on a Todo item, `reviewed` and `merge` on a Review item, `stop` on a Waiting item, and `allow` and `deny` on an Authorizations item each need one verb and one outcome.
- **A question asked of an item.**
  `Decide.1: how would B work?` leaves the item open, and the agent's restatement supersedes it.
- **A report that settles a Waiting item,** and a merged pull request that settles a Review item: each an `observe` that a watch rule turns into `resolve`.

## What it gives

A dated report, `agents/reports/<date>-list-moves-fit-transitions.md`, `state: current`, its `as-of` the commit it read:

- how many moves it found, by verb;
- each misfit, with the two turns it's between and what the table lacks: a verb, an actor's right or a guard;
- for each misfit, the row to add or change.

Checks:

- the report exists and names a verb, or a misfit, for every move in the golden cases;
- each misfit is answered by an edit to the transition table in [item-model-in-spec](../open/item-model-in-spec.md), in the commit that adds the report, or the report says why none is needed.
