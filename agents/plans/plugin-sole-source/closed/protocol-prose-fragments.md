---
title: The protocol's prose rules are Markdown fragments, and the prompt.context instructions and a derived SKILL.md are assembled from them
state: implemented
kind: implementation
part-of: plugin-sole-source
needs: [protocol-spec-data]
touches: [plugin/spec/, plugin/src/protocol/instructions.ts, plugin/src/protocol/prose.ts, plugin/src/protocol/kinds.ts, plugin/src/protocol/fragments.ts, plugin/src/text/, plugin/tools/spec/, plugin/src/pane/view.ts, plugin/hooks/register.tsx, plugin/test/unit/protocol/instructions.test.ts, plugin/test/unit/protocol/prose.test.ts, plugin/test/unit/protocol/kinds.test.ts, plugin/test/unit/text/]
implemented-by: protocol-prose-fragments
---

# The protocol's prose rules are Markdown fragments, and the prompt.context instructions and a derived SKILL.md are assembled from them

- **What the fragments hold.** The rules a parser can't check, such as:
  - a progress update is one line whose state emoji show what is done, running and next;
  - each item's bold summary reads alone, and a Decide option says its pros and cons;
  - an answer that asks a question is answered in its item and restated, never taken as a choice;
  - when the 📌 roll-up is written in full and when as a count line.
- **Beside the spec.** The fragments sit in `plugin/spec/fragments/`, beside the spec ([protocol-spec-data](protocol-spec-data.md)), one fragment per topic. A fragment names a list, glyph or command by a placeholder the assembly fills from the spec, so no fragment restates a value the spec holds:
  - every string and number in the spec by its path, `{{lists.decide.header}}`;
  - values worked out from them, such as a header as drawn, `{{header.decide}}`, its underline, `{{rule.decide}}`, the lists in words, `{{names.rolled-up}}`, and examples, `{{example.count-line}}`;
  - the plugin's own, `{{plugin}}` and `{{tool}}`.
- **Two outputs, one assembly.** `plugin/src/protocol/prose.ts`, pure and handed the spec rather than importing it, fills and assembles the fragments:
  - `instructions.ts` builds the `prompt.context` block from them, the turn-response format and the plugin's own tools together, so a session with the plugin and no skill learns the whole format; `INSTRUCTION_FRAGMENTS` names the fragments it holds, in order;
  - the derived skill's build ([derived-skill-package](derived-skill-package.md)) assembles SKILL.md from the same fragments with the same function.
- **The plugin's own words too.** Text in the core and the hooks that names a list or a kind in words, such as the tool's description, the pane's title and messages in `view.ts`, and the labels in `register.tsx`, takes the name from the spec, so the end state's search finds no header left in it.
- **No I/O in the core.** The spec's build step writes the fragments into a generated TypeScript module, `src/protocol/fragments.ts`, beside the spec's, so the core imports them as it imports the spec, and the same out-of-date check covers them. The build step refuses a fragment with a placeholder the spec has no value for, so a spec change that takes a value away fails `spec-build` and `nix flake check`.

Checks:

- `instructions.test.ts` checks that the assembled block holds every fragment and every list's header from the spec;
- a test fails on a placeholder the spec has no value for, and on a fragment no output uses.
