---
title: Every list item in the fixture transcripts fits one row of the filter table, or a report names the field it lacks
state: implemented
kind: implementation
part-of: items-events-views
touches: [agents/reports/, plugin/spec/cases/, plugin/test/fixtures/]
implemented-by: items-events-views-build
---

# Every list item in the fixture transcripts fits one row of the filter table, or a report names the field it lacks

The model says each of the 9 lists is a filter over 3 independent fields, kind, owner and state, written down as if it were a type.
This check tests that claim against real replies before [item-model-in-spec](../open/item-model-in-spec.md) writes the fields into the spec.
It writes no code.

## The filter table

| List              | Kind     | Owner    | State          | Extra condition                                  |
| ----------------- | -------- | -------- | -------------- | ------------------------------------------------ |
| ✅ Done           | task     | agent    | closed         | closed in this turn, outcome `done`              |
| 🚧 Pending        | task     | agent    | open or active | —                                                |
| 📝 Logged         | task     | anyone   | closed         | outcome `transferred`, with a link to a tracker  |
| ⏳ Waiting        | any      | external | open or active | or blocked by a harness entity                   |
| ❓ Answers        | question | agent    | closed         | raised by the person in this turn's prompt       |
| 🔑 Authorizations | question | user     | open           | yes or no, and it gates an action                |
| 🔍 Review         | task     | user     | open           | about an artefact, such as a pull request        |
| 👉 Todo           | task     | user     | open           | —                                                |
| 🧠 Decide         | question | user     | open           | —                                                |
| 📌 roll-up        | any      | anyone   | open or active | raised before this turn                          |

## What it does

- **The transcripts.**
  The golden cases in `plugin/spec/cases/` and the transcripts in `plugin/test/fixtures/` that the differential tests run, every reply with a list in them.
  A live session's transcript may be read for more items, counted in the report and quoted nowhere, since a session holds the person's own text.
- **The labels.**
  Each list item is labelled by hand with its kind, owner and state, and any condition the row needs, such as a link.
- **The finding.**
  An item that fits its list's row confirms it.
  An item that fits no row, or fits its row only with a field the item shape lacks, is a misfit, and the report names the field or the row that would hold it.

## What it gives

A dated report, `agents/reports/<date>-lists-fit-filter-table.md`, `state: current`, its `as-of` the commit it read:

- how many items it labelled, per list, and how many fit;
- each misfit, with the reply it's in and the field it lacks;
- for each misfit, the change to the item shape or the table, or why the item is prose and no item.

Checks:

- the report exists and labels every list item of every golden case;
- each misfit is answered by an edit to [item-model-in-spec](../open/item-model-in-spec.md) or [items-events-views](../open/items-events-views.md), in the commit that adds the report, or the report says why none is needed.
