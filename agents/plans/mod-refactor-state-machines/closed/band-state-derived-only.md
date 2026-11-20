---
title: The band atom stores only what can't be derived
state: rejected
kind: implementation
part-of: mod-refactor-state-machines
needs: [band-transitions-reducer]
touches: [plugin/src/band.ts, plugin/types/index.d.ts, plugin/hooks/register.tsx, plugin/test/band.test.ts]
---

# The band atom stores only what can't be derived

- `settledRefs` becomes a selector over `knownRefs` and `items`.
- Visibility becomes a union, `{ kind: "shown" } | { kind: "away" } | { kind: "dismissed", refs }`, so `dismissedRefs` exists only while dismissed.
- The atom's shape tag moves to `band-3`.
- Rejected: `kanban-band-status` removes the ❌ fold and the fit checks, and `dismissedRefs` with them, so the stored shape waits for that node rather than changing twice.
