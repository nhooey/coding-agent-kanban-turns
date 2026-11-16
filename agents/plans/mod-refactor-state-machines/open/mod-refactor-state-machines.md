---
title: The mod's state changes are pure transitions, and its hooks only dispatch and draw
state: approved
kind: end-state
---

# The mod's state changes are pure transitions, and its hooks only dispatch and draw

With this done:

- **Every state machine is one pure function.** The band's visibility, its position and the items' lifecycle change only through `step(band, event)` in `mod/src/band.ts`, a switch over an exhaustive `BandEvent` union that a `never` check closes. The upcoming basket gets its own `basketStep` the same way.
- **Hooks don't decide.** Each hook in `mod/hooks/register.tsx` reads its event, reads what it needs from the engine, dispatches one event and draws. No hook sets `position`, `isAway` or `isDismissed` itself, and no event takes two `update`s.
- **What can be derived is a selector.** The band's view mode and an option's picked state are worked out from stored state, not stored beside it. The band atom's stored fields, `settledRefs` and `dismissedRefs` among them, stay as they are until `kanban-band-status` removes the dismissal.
- **No reachable combination is unhandled.** Dismissed-and-away, a pane open over a dismissed band and a 🧠 press that changes nothing can't happen, or each has a defined transition.
- **Pure code lives in `mod/src/` with unit tests.** The text the hooks build, the tool's schema and description, the `outstanding.py` argv and its result parsing move out of `register.tsx`.
- **The option buttons are one component** in `mod/hooks/views.tsx`, taking callbacks, not `$`, ready for `kanban-items-tool-row` and `kanban-band-status` to draw in two places.

## The state machines today

From a read of `master` at 23d9595:

- **Band visibility,** `isDismissed` × `isAway` in the `band` atom, with the pane's being shown and the items' fit worked out in the render (`register.tsx:389-397`). prompt.submit and Reassess set away, turn.complete clears it, ❌ dismisses, a new ref, `/answers`, 🧠 or a question link reopen. Reachable but unhandled: dismissed and away at once (open the pane from the folded band during a reply, then ❌), a pane open over a dismissed band, 🧠 with items too tall (clears the flags, still draws folded), 🧠 during a reply clearing away early, and `dismissedRefs` kept stale after a reopen.
- **Position,** moved by prev, next, skip and mark straight in effect code (`register.tsx:544-548`, `:577-606`), and by answer and note through `rewriteDraft`'s callbacks.
- **Item lifecycle,** known through `kanban_options` calls, settled when known but no longer open. `settledRefs` is stored though derivable.
- **Draft,** mirrored from prompt.change into the `draft` atom, while `rewriteDraft` reads `$.prompt.read()`: two sources of truth.
- **Settings,** unread, loaded or broken; re-read on each refresh.
- **Refresh,** started unawaited at session.start and again from turn.complete and `/answers`, with nothing ordering overlapping runs.

Checks: the core's tests hold a table-driven test for each machine's transitions, `plugin-test`'s engine tests pass unchanged, and `register.tsx` has no assignment to a band field outside `dispatch`.
