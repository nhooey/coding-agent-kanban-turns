---
title: A command the person is asked to run is a control that fills the prompt with it as a `!` line, so its output lands where the agent reads it, and a refused action also offers its grant
state: approved
kind: implementation
part-of: items-events-views
needs: [item-renderer-densities, item-tool-declares-events, item-reference-grammar, pane-view-state]
touches: [plugin/spec/kanban.yaml, plugin/spec/kanban.schema.yaml, plugin/spec/fragments/, plugin/src/items/, plugin/src/harness/, plugin/src/views/, plugin/hooks/, plugin/cli/, plugin/defaults/config.yaml, plugin/types/index.d.ts, plugin/test/unit/, plugin/test/engine/, README.md]
---

# A command the person is asked to run is a control that fills the prompt with it as a `!` line, so its output lands where the agent reads it, and a refused action also offers its grant

An item that asks the person to run a command leaves two jobs to them: copying the command out of the item, and telling the agent what it printed and when it ended.
Both go: the command is a control, and its output reaches the agent without the person carrying it.
An action the harness or a classifier refused the agent is the same case with one more way out, the person's permission in their own words, which is a control too.

- **A command is a field, and its control is the item's `start`.**
  An item that asks the person to run a command holds the command as a field of its own, which the item tool's `raise` carries.
  Its card draws the item's `start` control as the command's: one line, opening on its emoji, in the one control shape of [the renderer](item-renderer-densities.md).
  A press writes the pick into the draft as every press does ([pane-view-state](pane-view-state.md)), and this pick's text is the command itself.
- **`!` by default.**
  The line is `! <cmd>`, so it runs in the prompt's shell mode and its output lands in the conversation, where the agent reads it.
  The `raise` carries a field saying the command must run in another shell, which the instructions have the agent set only when it's truly needed, such as a command that needs a terminal of its own or outlives the session.
- **The filled line is the queued event.**
  The draft's parser, [the grammar](item-reference-grammar.md)'s, reads a line that is `!` and an open item's command, matched to that command exactly, as that item's queued `start`.
  Submit cements it and deleting the line undoes it, as with any pick.
  A command the person edits by hand is no longer that item's start: it's a shell line of their own.
  No verb is added for it and no `special` entry: the control is a transition's, so [the end state](items-events-views.md)'s three special cases stay three.
- **The adapter reads the submitted command too.**
  A `!` command the person submits is in the transcript as bash input, and the Claude Code adapter reads one that matches an open item's command exactly as that item's `start`, by the user, with the record as its evidence.
- **A command that has run settles its item.**
  A `!` command runs synchronously, so its submitted line is the item's `start` and its bash output follows it in the transcript.
  The instructions have the agent, on reading that output, resolve the item through the item tool: `done` where the command's effect is in place, or the item stays open, with the error as a note.
  The agent checks the effect, and never the output alone: a push is done when origin has the sha, and a removal when the path is gone.
  A command whose target is already in that state, such as one that answers `not a working tree` or `branch not found`, resolves the item `done`, with a note that it was already so.
  The same holds with no run at all: the agent closes a task it raised by checking the state it asks for, and never waits for the person to write `done`.
  It rests on the `resolve` rights in [the spec](item-model-in-spec.md) and [the item tool](item-tool-declares-events.md)'s refusals letting an item's raiser close it as `done` on evidence it cites, the bash output's record or its own check of the state.
- **A `!` line fills only an empty draft.**
  `!` opens shell mode at the prompt's start alone.
  With text in the draft, the control does nothing, and its hint says to send or clear the draft first.
- **A probe comes first.**
  An engine test finds whether `$.prompt.fill("! cmd")` puts the prompt into shell mode, and a note in the node's report asks the person to try it in a live session, which the engine test can't stand for.
  - Where it does, the control fills `! <cmd>`.
  - Where it doesn't, and the engine can place the cursor, the control fills `<cmd>` with the cursor at its start, and the control's hint tells the person to type `!` and press Enter.
  - Where neither works, the finding is reported and nothing further is built until the person answers.
- **Another shell goes through a wrapper.**
  A command that must run in another shell is wrapped by a project tool, a tested script under `plugin/`.
  The wrapper prints a high-level status line per step to the terminal, and writes the command's full output to a log file whose path the item holds.
  The card draws the wrapped command as the line the person runs.
- **There, the start control is labelled Started.**
  Nothing of the command is submitted, so the control writes the item's `start` as an ordinary pick, and it rests on `start` being a transition the person may fire with a control of its own in [the spec](item-model-in-spec.md).
  The instructions teach what follows: on that event the agent arms a Monitor on the log's status lines, reads the log in detail only when it needs to, and resolves the item or reports when the run ends.
  The person never has to say it's done.
- **A refused action draws Grant, Run it yourself and No.**
  An item for an action the harness or a classifier refused is an approval, the preset the model has for a grant, and never a task.
  Its `raise` records the refused call's exact text, the command or the action as it was refused, and the card draws three controls in the one control shape:
  - **Grant** appends `I give you permission to <the refused command or action>` to the draft, on a line of its own, as a pick is appended.
    The text after `to` is the recorded one, verbatim, and never a paraphrase, since a permission in other words may not cover the call.
    The draft's parser reads that sentence, with the item's refused text matched exactly, as that item's approval, queued until Submit and undone by deleting the line.
  - **Run it yourself** is the command's control above, with the same line, and the same wrapper and Started control where it runs in another shell.
    It's there for a refusal the person's permission wouldn't lift.
    An approval is a question, which has no `active` state for a `start` to reach, so on it the command's line, or Started, is the item's `resolve`: the outcome `answered`, with the note `ran it myself`.
    The person doing the action answers whether the agent may, and the agent reads whether the command succeeded from its output.
  - **No** is the approval's own option, which answers the item as any option does.
    There is no separate Yes: Grant is the yes, in the words the harness reads.

  A plain command, on an item that records no refusal, draws the run control alone.
- **The lines are the core's, and read back.**
  One pure function gives each line, the command's in both forms and the grant's, from the item's fields, and the parser reads each back as the event its control fires; the hooks hand the text to the engine and decide nothing.
  Each control's emoji, label and hint are settings, under `actions` in `plugin/defaults/config.yaml`, as every control's are, and the grant's opening words are one too.

Checks:

- a unit test of each line: `! <cmd>`, the wrapped command of another shell, and the grant, which holds the refused command byte for byte;
- a property test that the parse of the line a control writes is that control's event on its item, and that a command or a grant edited by hand is no item's event;
- unit tests of the adapter: a submitted `!` command that matches an open item's command is that item's `start`, by the user, or, on an approval, its `resolve` as `answered` with the note `ran it myself`, and one that matches none is no event;
- a test that a `!` command's bash output, followed by the agent's `resolve`, closes the item, and that an error's `note` leaves it open;
- a test that an item whose command's target is already in place is resolved `done` with no run;
- engine tests that pressing the run control fills an empty draft, that it leaves a draft with text as it was and shows its hint, and that Grant appends its line;
- a test that Grant, Run it yourself and No are drawn for a refused action, with no Yes, and the run control alone for a plain command;
- the probe's engine test of `$.prompt.fill("! cmd")`, with its finding in the node's report;
- a test of the wrapper's status lines on the terminal and its full output in the log file;
- a test that the Started control fires `start`, by the user;
- `README.md` says how a command an item asks for is run, in both forms, and how a refused action is granted.
