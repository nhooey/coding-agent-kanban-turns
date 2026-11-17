---
title: The text and predicates the hooks build live in the core, with tests
state: implemented
kind: implementation
part-of: mod-refactor-state-machines
touches: [mod/hooks/register.tsx, mod/src/view.ts, mod/test/view.test.ts]
---

# The text and predicates the hooks build live in the core, with tests

- A new `src/view.ts` holds `bandView(band, { fits, paneShown, hasSurvey, hasSettings })`, returning `"none" | "full" | "folded" | "folded-tall"`, from the inline test at `register.tsx:389-397`.
- It also holds the strings built inline today: the folded label (`:406-408`), the empty message `/answers` and the pane share (`:329-332`, `:456`), the `/answers-config` text (`:316-319`), the tool's result text (`:341`), the tool-row title (`:516`), and `isPlainToolRow` (`:489-493`, `:467-471`).
- No state changes; each function gets a test in `test/view.test.ts`.
