---
title: The pane's state is one value that a pure step function moves, and the hooks only dispatch events and run the effects it returns
state: in-progress
owner: pane-state-reducer
kind: implementation
part-of: pane-every-list
needs: [neutral-turn-stream]
touches: [plugin/src/pane/pane-state.ts, plugin/src/pane/view.ts, plugin/src/items/raised.ts, plugin/hooks/register.tsx, plugin/types/index.d.ts, plugin/test/unit/, plugin/test/engine/, plugin/test/oracle/, plugin/test/fixtures/, AGENTS.md]
cost: "about 29M tokens over 10 runs, 5 implementer and 5 review, one pair per area; about $30 at Opus 5.5's rates; weekly share not costed, no weekly limit set"
---

# The pane's state is one value that a pure step function moves, and the hooks only dispatch events and run the effects it returns

The pane's state is 15 atoms in `plugin/hooks/register.tsx` today: `raised`, `sent`, `expanded`, `focused`, `isKeysOpen`, `refreshes`, `merged`, `draft`, `noting`, `submits`, `submitting`, `runningTurn`, `submitProblem`, `counts` and `settings`. Each hook reads and writes several of them between `await`s, so what one hook decides depends on what another wrote meanwhile. `sendDraft` updates `submitProblem`, `draft` and `sent` around each `await` on the engine, and `submitDraft` guards itself with a `submits`/`submitting` stamp. [pane-decide-filters](pane-decide-filters.md) and every node in this plan from [items-of-every-list](items-of-every-list.md) on add to that state, so this node comes first and they build on its shape.

## What is true when it's done

- **One state value.** The pane's state is one readonly `PaneState` in `plugin/src/pane/pane-state.ts`, with no `claude-code` import, held in one atom with one shape tag. The `instructed` atom isn't pane state and stays as it is.
- **Events are data.** Every change to the state is an `Event` value, one union that a `never` check closes:
  - the person's keys and clicks: an option picked, a note, Submit, ✖, `? Keys`, a Done toggle, the focus ring moving;
  - the engine's events: session start, turn start and complete, a prompt change, the pane closed, a `kanban_options` call;
  - the effects' results: the transcript read, the settings read, a draft sent, a submit refused, a pull request merged.
- **A pure step function.** `step(state, event)` returns `{ state, effects }`, the effects as data, in the Elm-architecture style: fill the prompt, submit, close the pane, open it, read the transcript, read the settings, ask `gh`, reveal an element.
- **The hooks are a thin interpreter.** Each hook builds one event and dispatches it. `dispatch` applies `step` in a single `update` of the one atom, runs the effects it returned, and dispatches each effect's result as an event. The view stays a pure function of the state, in `plugin/src/pane/view.ts`. Data flows one way, and no hook writes the state outside `dispatch`.
- **Illegal states are unrepresentable.** Sum types replace loose flags:
  - **Submit** is one `submit` field, replacing `submits`, `submitting`, `runningTurn` and `submitProblem`: idle, a turn running (by its id, so a late end of an earlier turn leaves it), sending (with the draft and the refs it moved to Done), or refused (with why). A press does nothing while a turn runs or a draft is sending because `step` says so, not because of a stamp. The overlap of sending and the turn it starts is one defined transition.
  - **Refresh** is one field replacing the `refreshes` stamp: how many refreshes were asked for, the one whose transcript read is shown, and the reads still out, each under its refresh's number. Reads run side by side, and `step` drops a read no newer than the one shown, so an older refresh never replaces a newer one. A read that couldn't read the transcript shows nothing, so an older one that did still lands, and joining another session counts every read out as shown.
  - **Settings** keep their three states as one field: unread; loaded, with the settings, where each came from and the files' warnings; or broken, with why. Reads are numbered, and `step` drops a read no newer than the one in effect, so an older read never replaces a newer one. A refresh reads the settings, then the transcript while they're usable, and its result is drawn with the settings in effect as it lands. A turn's end that holds answers reads the transcript even while the settings are broken, so whether it lets go of them hangs on whether it read the transcript alone, whichever settings read answers first; it settles nothing then. `step` reads the close setting from the field, so it takes nothing from outside its state. Against the old handlers, the dropped older read is a race made unreachable; drawing with the settings in effect, and a turn's end reading the transcript to let go of its answers while the settings are broken, where the old handlers kept them held, are fixes.
- **A press a reload overtook keeps to itself.** A press a session's start overtakes finishes as it would have, under its own number. Each answer it holds Done is tagged with its press, so its refusal puts back only its own holds and leaves a later press's for the same item. Its message is kept apart from what the pane says of the press under way, on a line of its own, until a turn starts, the session starts again or a press pressed since ends; a press that sends nothing and says nothing new, for a box of blanks, keeps it, as it keeps all the pane said before it. The two presses still share the prompt box, which the engine has one of.
- **Order.** It starts with the Submit flow, the one with the races, and moves one area at a time, each its own commit: Submit, then the transcript refresh with `raised`, `sent`, `merged` and `counts`, then settings, then the pane's own state (`folds`, `focused`, `held`, `isKeysOpen`, `noting`), then `draft`. Until an area moves, its atoms stay, and `step` doesn't touch them.

## One atom, not slices

One atom with one shape tag, because:

- **The single update is the point.** `step` sees the whole state and its result lands in one `update`, so no event can read a half-written state. Slices in several atoms would need several updates per event, the race this node removes.
- **A reload loses little.** A changed shape tag declines everything stored, and most of it doesn't outlive a reload today anyway:
  - session start already clears `runningTurn`, `submitting`, `submitProblem`, `sent` and `focused`, so `SessionStarted` resets the same fields in `step`;
  - the refresh session start runs rebuilds `raised`, `counts` and `settings` from the transcript and the files;
  - `draft` comes back from the prompt box.

  What a tag change really loses is `folds`, the toggles a click moved, `isKeysOpen` and `noting`, and `merged`, which the next refresh asks `gh` for again. A tag changes only with a release that changes the shape, so that's worth one atom.

## Checks

- **Event sequences.** `plugin/test/unit/pane/pane-state.test.ts` drives `step` through named sequences and checks the state and effects after each: a Submit sent, refused and put back; a press while a turn runs; a late end of an earlier turn; a refresh whose result lands after a newer one started; the pane closing when Submit leaves nothing open.
- **Invariants over random sequences.** A property test drives `step` through random event sequences, repeats and out-of-order results among them, and checks after every step, as `design-hygiene-find-implicit-models` describes:
  - every sent ref is a raised one;
  - a sent draft closes the pane only when nothing is left open;
  - Submit sends at most one draft at a time;
  - a turn's end clears only the turn it names;
  - an older refresh's result never replaces a newer one's.
- **The old handlers against the reducer.** While each area moves, a differential test drives today's handlers, as the hooks sequence them, and `step` through the same random sequences, and finds the same observable outcome: the raised and sent items, the problem the pane says, the count line and whether the pane is open. Each difference is classed in the area's commit message as a fix or as a race now unreachable. The test goes once the last area has moved.
- **Unchanged from outside.** The engine tests in `plugin/test/engine/` pass unchanged, and `typecheck-plugin` and `plugin-test` pass in the dev shell.
- **No writes outside dispatch.** `register.tsx` has no `update` of pane state outside `dispatch`.
