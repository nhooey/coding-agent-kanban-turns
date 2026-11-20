---
title: The mod's state changes are pure transitions, and its hooks only dispatch and draw
state: superseded
superseded-by: kanban-pane
kind: end-state
---

# The mod's state changes are pure transitions, and its hooks only dispatch and draw

With this done:

- **Every state machine is one pure function.** The band's visibility, its position and the items' lifecycle change only through `step(band, event)` in `plugin/src/band.ts`, a switch over an exhaustive `BandEvent` union that a `never` check closes. The upcoming basket gets its own `basketStep` the same way.
- **Hooks don't decide.** Each hook in `plugin/hooks/register.tsx` reads its event, reads what it needs from the engine, dispatches one event and draws. No hook sets `position`, `isAway` or `isDismissed` itself, and no event takes two `update`s.
- **What can be derived is a selector.** The band's view mode and an option's picked state are worked out from stored state, not stored beside it. The band atom's stored fields, `settledRefs` and `dismissedRefs` among them, stay as they are until `kanban-band-status` removes the dismissal.
- **No reachable combination is unhandled.** Dismissed-and-away, a pane open over a dismissed band and a 🧠 press that changes nothing can't happen, or each has a defined transition.
- **Pure code lives in `plugin/src/` with unit tests.** The text the hooks build, the tool's schema and description, the `outstanding.py` argv and its result parsing move out of `register.tsx`.
- **The option buttons are one component** in `plugin/hooks/views.tsx`, taking callbacks, not `$`, ready for `kanban-items-tool-row` and `kanban-band-status` to draw in two places.

## The implicit models today

From a read of `master` at 23d9595, in `design-hygiene-find-implicit-models`' five kinds. Each says what making it explicit deletes, and whether it changes.

- **Band visibility, a lifecycle.** `isDismissed` × `isAway` in the `band` atom, with the pane's being shown and the items' fit worked out in the render (`register.tsx:389-397`). prompt.submit and Reassess set away, turn.complete clears it, ❌ dismisses, a new ref, `/answers`, 🧠 or a question link reopen. Reachable but unhandled: dismissed and away at once (open the pane from the folded band during a reply, then ❌), a pane open over a dismissed band, 🧠 with items too tall (clears the flags, still draws folded), 🧠 during a reply clearing away early, and `dismissedRefs` kept stale after a reopen. Deletes: 2 reachable illegal states and the 2 paired `update`s in turn.complete (`:353-354`) and `reopen` (`:251-253`). Changes, in `band-transitions-reducer`.
- **Position, a lifecycle.** Moved by prev, next, skip and mark straight in effect code (`register.tsx:544-548`, `:577-606`), and by answer and note through `rewriteDraft`'s callbacks. Deletes: fullView's `move` closure and the 4 position writes in its buttons, which become `Moved` events. Changes, in `band-transitions-reducer`.
- **Item lifecycle, a lifecycle and a data copy.** Known through `kanban_options` calls, settled when known but no longer open; `settledRefs` is stored though derivable. Deletes: 1 stored field and the line in `refreshed` that keeps it in step (`band.ts:143`). Left: `kanban-band-status` reshapes the band atom, so `band-state-derived-only` was rejected.
- **Draft, a data copy.** Mirrored from prompt.change into the `draft` atom (`register.tsx:372-377`), while `rewriteDraft` reads `$.prompt.read()` (`:221-231`): two sources of truth. Deletes: the second read, once `option-button-component`'s `pickedOf` reads one source. Changes there, and `kanban-answers-basket` replaces the draft as the store.
- **Settings, a lifecycle.** Unread, loaded or broken; re-read on each refresh (`:196-203`). Deletes nothing: three states in one field already. Left.
- **Refresh, a flow.** Started unawaited at session.start (`:303`) and again from turn.complete (`:353`) and `/answers` (`:251`), each awaiting a settings read and an `outstanding.py` run of up to `outstanding.timeout-ms`, 20 s by default. Nothing orders overlapping runs, so an older run finishing last writes stale items over newer ones. The bound is one run at a time and the policy at it is keep-latest: a refresh asked for while one runs replaces any refresh already waiting. Deletes: the stale-write race. Changes, in `band-transitions-reducer`.
- **The `outstanding.py` run, a failure model.** One child process per refresh (`:156-167`), started and awaited by `openItems`, bounded by `timeoutMs`; a non-zero exit, a timeout or a thrown error becomes the band's `problem` (`:168-174`, `:183-186`), and nothing retries, so the next refresh is the restart. Deletes nothing: it already has a bound, an owner and a place its failure surfaces. Left; `kanban-mod-reads-transcript` removes the process.

Checks: `band-differential-test` passes against the reducer as it did against today's code, every difference classed as a fix or as one of the illegal states above; the core's tests hold a table-driven test for each machine's transitions; `plugin-test`'s engine tests pass unchanged; and `register.tsx` has no assignment to a band field outside `dispatch`.
