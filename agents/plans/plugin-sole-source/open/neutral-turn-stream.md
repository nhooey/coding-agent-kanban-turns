---
title: The core works on harness-neutral turns, and a Claude Code JSONL adapter produces them
state: approved
kind: implementation
part-of: plugin-sole-source
touches: [plugin/src/transcript.ts, plugin/src/outstanding.ts, plugin/src/reports.ts, plugin/src/raised.ts, plugin/types/index.d.ts, plugin/test/]
---

# The core works on harness-neutral turns, and a Claude Code JSONL adapter produces them

- **A neutral turn.** One type in `plugin/types/index.d.ts`, with:
  - `id`: the turn id;
  - `owner`: who wrote the prompt: the user, this plugin, another plugin, an agent's report or a notification;
  - `prompt`: the prompt's text;
  - `reply`: the final response's text.
- **The core takes neutral turns.** The functions that read open items, settle them, build the count line and the roll-up, and lint a reply take a readonly array of neutral turns, and nothing in them knows a JSONL record's shape.
- **One adapter per harness.** A pure Claude Code adapter turns the session's JSONL records into neutral turns, holding all of today's knowledge of Claude Code's records: which prompt is the user's, which is a plugin's, which is a subagent's report or a notification. Another harness gets an adapter of its own, beside it, and the core is unchanged.

Checks:

- a test in `plugin/test/` for the adapter, over the JSONL fixtures the transcript tests use today, giving each record's owner;
- the core's tests pass taking neutral turns, with no JSONL record in them.
