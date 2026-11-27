---
title: The agent declares items and their changes through one tool, which checks each event against the transition table and gives back the ids
state: approved
kind: implementation
part-of: items-events-views
needs: [item-event-reducer, task-list-matches-pending, hooks-split-by-concern]
touches: [plugin/hooks/register.tsx, plugin/src/protocol/tools.ts, plugin/src/transcript/claude-code.ts, plugin/spec/kanban.yaml, plugin/spec/fragments/tool.md, plugin/src/protocol/instructions.ts, plugin/test/unit/protocol/, plugin/test/unit/transcript/, plugin/test/engine/tools.test.tsx]
---

# The agent declares items and their changes through one tool, which checks each event against the transition table and gives back the ids

- **One tool.**
  The plugin registers the item tool, its name in the spec, beside its other tools.
  A call takes a list of events in order, each a verb, the item it's about and the verb's arguments: a `raise` carries the kind, an optional preset, the summary, the body, the owner, a question's `response`, the urgency, the links, what it supersedes and what it `frees`, the items it holds up, which the fold gives a `blocked-by` link to it.
- **The schema comes from the spec.**
  The tool's input schema is built from the generated module: the verbs, the kinds, the presets and each event's arguments.
  A kind added to the spec is in the schema with no code changed.
- **Checked when written.**
  The tool folds the transcript's log, then steps each event of the call through [the fold](item-event-reducer.md)'s `step`, as `agent:main`.
  An event the table refuses changes nothing, and the result says which rule refused it, so the agent corrects the call and nothing is linted after the fact.
  The events before and after a refused one stand.
- **What the tool refuses on top of the table.**
  A `raise` owned by `external` with no link that has a watch rule, since nothing could ever close it; a preset's `requires` unmet, such as an approval with none of an `about` link, a `frees` and the refused call's text; and a `resolve` on the person's item that cites no prompt of theirs.
- **The result.**
  Plain text: each accepted event's item at line density, with its id, as [the renderer](item-renderer-densities.md) writes a line as text, then each refusal.
  A transcript read without the plugin shows the items there.
- **A call with no events gives the board:** every item that isn't closed, at line density, grouped by owner, which is how the agent reads the ids back after a compaction.
  After a compaction the plugin also adds the board to the next prompt's context, since the log is read from the file and the model's context doesn't hold it.
- **The adapter.**
  The Claude Code adapter reads each call of the tool whose result isn't an error into its turn's `events`, each `by: agent:main`, `in` its turn and `evidence` the tool call's id.
  A sidechain's calls are left out (open question 12 in [the end state](items-events-views.md)).
- **The instructions.**
  `plugin/spec/fragments/tool.md` teaches the tool from the spec's names: when to raise, that an item is raised once and changed by later events, that the id in the result is what the reply and the person refer to, and what each refusal means.
  The agent raises its own turn-level tasks through the tool, where the model has the task tools and where it doesn't, and the harness's task list stands for none of them, as [task-list-matches-pending](../../../reports/2026-11-27-task-list-matches-pending.md) found.
- **`kanban_options` stays** registered and read until [reply-prose-readers-retired](reply-prose-readers-retired.md).

Checks:

- unit tests in `plugin/test/unit/protocol/` for the schema built from the spec, and from the fixture spec with other names;
- unit tests in `plugin/test/unit/transcript/` for the adapter: a call's events in order, an errored call left out, a sidechain's call left out;
- engine tests in `plugin/test/engine/tools.test.tsx` that raise an item and read its id from the result, send an illegal event and read the refusal, raise an `external` item with no watch and read that refusal, and call with no events and read the board;
- a property test that the tool's verdict on an event equals `step`'s.
