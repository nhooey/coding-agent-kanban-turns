---
title: The kanban_options schema and description live beside the instructions that name the tool
state: approved
kind: implementation
part-of: mod-refactor-state-machines
touches: [mod/hooks/register.tsx, mod/src/instructions.ts, mod/src/layout.ts, mod/test/instructions.test.ts]
---

# The kanban_options schema and description live beside the instructions that name the tool

- `ITEM_SCHEMA` and `TOOL_DESCRIPTION` (`register.tsx:83-138`) move to `src/instructions.ts`, whose field list (`:390-394`) they repeat.
- `INDENT` (`register.tsx:56`) is exported once and used by `src/layout.ts` in place of its hard-coded `-3` and `-6`.
- A test checks that the schema's required fields are exactly what `itemsOf` accepts.
