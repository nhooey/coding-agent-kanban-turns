---
title: The core works on harness-neutral turns, and a Claude Code JSONL adapter produces them
state: implemented
kind: implementation
part-of: plugin-sole-source
touches: [plugin/src/transcript.ts, plugin/src/claude-code-transcript.ts, plugin/src/outstanding.ts, plugin/src/reports.ts, plugin/src/raised.ts, plugin/types/index.d.ts, plugin/test/]
implemented-by: "#47"
---

# The core works on harness-neutral turns, and a Claude Code JSONL adapter produces them

- **A neutral turn.** One type, `Turn` in `plugin/types/index.d.ts`, with:
  - `id`: the turn id;
  - `prompt`: a `Message`, the prompt's text and its `owner`, who wrote it: `user`, `this-plugin`, `other-plugin`, `peer` (an agent's report or another session's message) or `notification`;
  - `replies`: the texts of the agent's responses, the last its final one, since items are read from every response a turn prints;
  - `decide`: the Decide items the `kanban_options` tool raised;
  - `messages`: the `Message`s sent while the turn ran, the user's and others', in order.

  A `Message` also carries `reportNames`, the names it goes by where it reports that some work ended, such as a session's name or a finished task's id; a report naming a Waiting item settles it.
- **The core takes neutral turns.** The functions that read open items, settle them, and build the count line and the roll-up take a readonly array of neutral turns, and nothing in them knows a JSONL record's shape. The core, not the adapter, decides whose text counts: the user's own is `isOwn(owner)`, the user's or this plugin's, and only it answers items or runs commands; only the others' reports settle Waiting items. The reply lint, when it comes, reads neutral turns too.
- **One adapter per harness.** The pure Claude Code adapter, `plugin/src/claude-code-transcript.ts`, turns the session's JSONL records into neutral turns. It holds all of the plugin's knowledge of which Claude Code record is a prompt and whose, of how a report's names are written, and of where the transcript lies:
  - a prompt is the user's, a peer's or a notification by its `turnOrigin`;
  - a plugin's prompt is this plugin's or another's by its `pluginPrompt`, when the plugin sent it in its own name, or by its `origin` of kind `plugin`, when it sent it as the user, as this plugin's Submit and Reassess do; a plugin's meta message opens no turn;
  - a headless run's prompt, `turnOrigin` `sdk`, a scheduled one and any other origin open no turn.

  Another harness gets an adapter of its own, beside it, and the core is unchanged.
- **One other reader of the records.** `plugin/src/instructed.ts` reads the same records for whether the agent's instructions reached the conversation since the last compaction or `/clear`, a question no turn holds. It is Claude Code's, like the adapter, and another harness answers it its own way.

Checks:

- `plugin/test/claude-code-transcript.test.ts` tests the adapter over the JSONL fixtures in `plugin/test/records.ts`, giving each record's owner, a report's names and a tool call's Decide items;
- the core's tests pass taking neutral turns built directly, with no JSONL record in them;
- `plugin/test/neutral-turns.test.ts` drives random record sequences through the adapter and the core, and through the oracle in `plugin/test/oracle/`, which reads the records straight into turns with `isOwn`, and finds the same turns and the same outcomes after every record. A prompt a plugin sent as the user, which the oracle can't read, is handed to it in the shape it reads; the oracle is deleted once `protocol-spec-data` is rebased onto the neutral turns.
