---
title: The band shows the open counts and the answers waiting to be submitted
state: approved
kind: implementation
part-of: kanban-answers-in-transcript
needs: [kanban-mod-reads-transcript, kanban-answers-basket]
touches: [mod/hooks/register.tsx, mod/src/band.ts, README.md]
---

# The band shows the open counts and the answers waiting to be submitted

- The `AbovePrompt` hook draws a header line: the open counts from the mod's transcript reader, each list by its glyph in the skill's order, Pending, Waiting, Review, Todo, Decide, empty ones left out, then `📨 Submit (n)`.
- Under it, one line per basket entry in the order it was added, `9efb08a1.Decide.2.B: note ✖`, the note cut to the band's width. A click on ✖ takes that entry out, as a second click on its picked option does.
- With an empty basket the band is the header alone; with nothing open and an empty basket it draws nothing.
- Its height is the basket's size plus one, capped at the band's `maxRows`, scrolling within itself past that.
- The band's full item view, its height checks and the ❌ fold go; `/answers` opens the pane at the latest reply's Decide items.
- The pure parts, the header text and the entry lines, live in `src/band.ts` with their tests.
