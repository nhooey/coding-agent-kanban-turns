---
title: A session's Pending items are compared with its task list's open tasks at each turn's end, and a report says which the agent's tasks are read from
state: approved
kind: implementation
part-of: items-events-views
touches: [agents/reports/]
---

# A session's Pending items are compared with its task list's open tasks at each turn's end, and a report says which the agent's tasks are read from

The harness holds the agent's own tasks as entities with a lifecycle: `TaskCreate` and `TaskUpdate` give each a status of `pending`, `in_progress`, `completed` or `deleted`, an owner, and `blocks` and `blockedBy`.
The model projects them as the agent's tasks, so the agent never writes a task twice.
That holds only if the task list and the agent's 🚧 Pending list name the same work.
This check compares them, and its answer settles open question 5 in [the end state](items-events-views.md).
It writes no code.

## What it does

- **The sessions.**
  At least 3 sessions of this repository that call `TaskCreate` and write a Pending list, of 10 turns or more each.
  Their transcripts hold the person's own text, so the report gives counts and no quotation.
- **The comparison.**
  At each turn's end, the open tasks of the task list, as the `TaskCreate` and `TaskUpdate` calls up to there leave it, beside the items of that turn's Pending list and the 📌 roll-up's Pending items.
  Each Pending item is matched to a task by hand, as the same work, a part of it, or none.
- **The finding.**
  Per turn: the Pending items with a task, the Pending items with none, and the open tasks no Pending item names.

## What it gives

A dated report, `agents/reports/<date>-task-list-matches-pending.md`, `state: current`, naming the sessions by their ids:

- the three counts, per session and in total;
- which way they differ: tasks smaller than a turn's commitments, commitments the task list never held, or both;
- the recommendation that follows:
  - **project** the task list, where most Pending items have a task and the tasks left over are steps of one;
  - **raise through the tool**, where most Pending items have no task, so the agent declares its turn-level tasks itself and the task list is evidence alone.

Checks:

- the report exists, with the counts for each session;
- [harness-observations-as-events](harness-observations-as-events.md) and [item-tool-declares-events](item-tool-declares-events.md) say which of the two they build, in the commit that adds the report.
