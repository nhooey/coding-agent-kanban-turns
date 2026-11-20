---
title: One pure step function moves the band, and hooks dispatch to it
state: superseded
superseded-by: pane-lists-raised-items
kind: implementation
part-of: mod-refactor-state-machines
needs: [mod-view-text-in-core, band-differential-test]
touches: [plugin/src/band.ts, plugin/hooks/register.tsx, plugin/test/band.test.ts]
---

# One pure step function moves the band, and hooks dispatch to it

- `src/band.ts` gains `BandEvent`: `Refreshed`, `ReplyEnded` (refresh and back in one), `Submitted`, `Dismissed`, `Reopened`, `LinkPressed`, `Moved{to: "prev" | "next" | "skip" | n}`, `Answered`, `Noted`, `ToolDrew`, each carrying the items, problem or draft it needs. `step(band, event)` switches over it exhaustively; today's `away`, `back`, `dismissed`, `reopened`, `refreshed` and `afterChoice` become its cases.
- `register.tsx` gains one `dispatch($, event)`, and fullView's `move` closure, the paired `update`s in turn.complete and `/answers`, and the problem written after `refreshed` all go through it. Reassess, and later the basket's Submit, dispatch `Submitted` themselves, since `$.prompt.submit` skips the prompt.submit hook.
- The unhandled combinations get defined transitions: `Dismissed` while away, `Reopened` while away, a pane opened over a dismissed band, 🧠 when the items don't fit.
- Refresh runs one at a time, and a refresh asked for while one runs replaces any already waiting, so overlapping runs can't land out of order.
- `test/band.test.ts` holds a table of (state, event, expected state) rows; `band-differential-test` passes against the new code with every difference classed; the engine tests in `plugin-tests/band.test.tsx` pass unchanged. The atom's shape stays `band-2`.
