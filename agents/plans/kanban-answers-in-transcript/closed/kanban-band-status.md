---
title: The band shows the open counts, the latest reply's Decide buttons and the answers waiting to be submitted
state: superseded
superseded-by: count-line-opens-pane
kind: implementation
part-of: kanban-answers-in-transcript
needs: [kanban-mod-reads-transcript, kanban-items-tool-row, kanban-answers-basket]
touches: [plugin/hooks/register.tsx, plugin/src/band.ts, README.md]
---

# The band shows the open counts, the latest reply's Decide buttons and the answers waiting to be submitted

- The `AbovePrompt` hook draws a header line: the open counts from the mod's transcript reader, each list by its glyph in the skill's order, Pending, Waiting, Review, Todo, Decide, empty ones left out, then `📨 Submit (n)`.
- Under the header, the latest reply's Decide items, drawn by the same option-button component the tool row uses (`kanban-items-tool-row`), from the items of the latest `kanban_options` call, which the mod keeps in `$.state`. A click here and a click on the same option in the tool row change the one basket entry, so both copies always show the same picks. A reply without a `kanban_options` call leaves this part out, and a settled item dims here as in the tool row.
- Under the items, one line per basket entry in the order it was added, `9efb08a1.Decide.2.B: note ✖`, the note cut to the band's width. A click on ✖ takes that entry out, as a second click on its picked option does. An entry from an older reply's item shows here as any other.
- With no Decide items in the latest reply and an empty basket the band is the header alone; with nothing open and an empty basket it draws nothing.
- Its height is the header, the latest reply's items and the basket's lines, capped at the band's `maxRows`, scrolling within itself past that.
- The band's full item view, its height checks and the ❌ fold go; `/answers` opens the pane at the latest reply's Decide items.
- The pure parts, the header text and the entry lines, live in `src/band.ts` with their tests.
