---
title: A differential property test pins today's band behaviour before the reducer replaces it
state: approved
kind: implementation
part-of: mod-refactor-state-machines
touches: [mod/package.json, mod/package-lock.json, mod/test/band-differential.test.ts, flake.nix]
---

# A differential property test pins today's band behaviour before the reducer replaces it

- fast-check joins the dev dependencies, with the flake's npm build updated to match.
- `test/band-differential.test.ts` drives the band through random sequences of its events, repeats and out-of-order ones included: refresh with generated items, submit, reply ended, dismiss, reopen, link pressed, prev, next, skip, mark n, answer, note and tool drew. After each step it records the band's observable outcome: the view `bandView` gives, the position, the shown item's ref, the dismissed, away and settled refs, and the problem.
- It is committed passing against today's functions in `src/band.ts`, sequenced as the hooks in `register.tsx` call them, with the outcomes for a fixed seed written to a fixture beside it. That fixture is the oracle `band-transitions-reducer` is checked against, step by step.
- Each difference the reducer makes is classed in its commit message as a refactor bug, fixed, or one of the illegal states `mod-refactor-state-machines` lists, now unreachable.
