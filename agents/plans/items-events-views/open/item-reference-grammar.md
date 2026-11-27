---
title: The person's own text names an item by its ordinal, and one parser reads each reference, such as `12.B` or `12 done`, as one event
state: proposed
kind: implementation
part-of: items-events-views
needs: [item-model-in-spec]
touches: [plugin/spec/kanban.yaml, plugin/spec/kanban.schema.yaml, plugin/spec/cases/, plugin/src/items/, plugin/src/transcript/, plugin/test/unit/items/]
---

# The person's own text names an item by its ordinal, and one parser reads each reference, such as `12.B` or `12 done`, as one event

- **The forms.**
  A reference is an item's ordinal, then what the person does to it:

  | The person writes   | The event                                                                              |
  | ------------------- | -------------------------------------------------------------------------------------- |
  | `12.B`, `12.A,C`    | `resolve`, outcome `answered`, the letters                                             |
  | `12.B: words`       | the same, with the words as the answer's note                                          |
  | `12: words`         | what the item's kind says its words are: an answer in words to a question, a note on a task |
  | `12 done`, `12 skip` | the control with that word: `resolve` with its outcome                                 |
  | `12 to agent`       | the control with that word: `assign`                                                   |
  | `12 reopen`         | `reopen`                                                                               |

  The words are the spec's `controls`, so a control added there is typed with no parser changed.
- **The grammar is in the spec.**
  `reference` in `plugin/spec/kanban.yaml` holds the forms' pieces: the ordinal, the letters' range, the separators, and what parts a note from a word.
- **Where a reference stands.**
  At the start of a line, or after one of the spec's separators, so several share a line, `12.B, 13 done`.
  Anything else in the prompt is the person's prose, and is read as no event.
- **Context in parentheses is skipped.**
  A reference may carry the item's context after it, `12.B (Which loader to keep → Keep the small loader)`, which the draft writes so the prompt reads alone, and which every reader skips.
- **A line that asks a question answers nothing.**
  `12: how would B work?` is a note, the item stays open, and the agent answers it and raises the question again where it has changed.
- **The person's own text alone.**
  The parser runs over a prompt the person typed and one the pane's Submit sent, and messages they sent while a turn ran.
  An agent's message, another session's, a task notification, a scheduled prompt and another plugin's prompt hold no event of the person's.
  The line naming the plugin that opens a draft is left out first.
- **One parser.**
  `eventsOf(text)` parses the text into candidate events, each `by: user`, with the line it came from, by a parser over the grammar and never a regular expression per form.
  Whether an event is legal is [the fold](item-event-reducer.md)'s to say, not the parser's.
- **The draft is written by the same grammar.**
  `withEvent(draft, event)` adds an event's line, replaces the item's earlier line or takes it out, and keeps what the person typed around it where it was.
  `eventsOf(withEvent(draft, event))` holds the event, for every event the grammar can write.
- **The draft is read as any text is.**
  What is queued is `eventsOf` of the draft's text, parsed again on every change to it, and the parser neither knows nor asks whether a press or the person's own typing wrote a line.
  So a hand edit counts: a line changed is the event it now reads as, a line deleted is no event, and a line the person types is an event as a press's is.
  A line edited into something that doesn't parse is prose, and queues nothing.
- **Submit is scanned, not remembered.**
  The events a submitted prompt holds are `eventsOf` of its text as sent, by the pane's Submit and by Enter alike; no list of presses is consulted.
  A pick the person deleted from the draft before sending is in no event, and its item stays outstanding.
- **The commands stay.**
  `reassess` and `open` are read as they are, from the prompt's first word or, for `reassess`, its last line.
- **The adapter.**
  A turn's `events` hold the person's events, from its prompt and its messages, each with the prompt's id as evidence, before the agent's events of that turn.
- **The old references stay readable** by the old readers until [reply-prose-readers-retired](reply-prose-readers-retired.md): `<turn>.<List>.<n>` names no item of the log.

Checks:

- unit tests in `plugin/test/unit/items/` for each form, for two references on a line, for a context holding `:` or `→`, for a line that asks a question, and for prose that opens on a number, `12 of the tests fail`, which is no reference unless a control's word follows the number;
- a property test of the round trip, over random drafts and events;
- a property test over drafts built by random mixes of `withEvent` and hand edits, a line changed, deleted, typed or broken, that `eventsOf` gives exactly the events of the lines that still parse, and that a deleted line's item is in none;
- golden cases in `plugin/spec/cases/` for each form, run by the core's tests and through the CLI;
- a control added to the fixture spec is read by its word with no code changed.
