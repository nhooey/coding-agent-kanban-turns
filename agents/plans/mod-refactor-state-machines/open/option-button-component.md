---
title: The option buttons are one component that takes callbacks
state: approved
kind: implementation
part-of: mod-refactor-state-machines
needs: [band-transitions-reducer]
touches: [mod/hooks/register.tsx, mod/hooks/views.tsx, mod/src/answers.ts, mod/test/answers.test.ts]
---

# The option buttons are one component that takes callbacks

- `itemView` (`register.tsx:638-759`) and `fullView` (`:534-625`) move to `mod/hooks/views.tsx` as function declarations taking `picked`, `onPick` and `onNote`, not `$`, since `claude plugin validate` follows `$` only into declarations.
- `pickedOf(item, draft)` in `src/answers.ts` replaces the separate `lettersFor` and `noteFor` reads (`:517-518`, `:617-618`), so the basket swaps the draft for itself in one place.
- This is the shared component `kanban-items-tool-row` names, drawn by the tool row and by `kanban-band-status`'s band.
