---
title: The protocol's prose rules are Markdown fragments, and the prompt.context instructions and a derived SKILL.md are assembled from them
state: approved
kind: implementation
part-of: plugin-sole-source
needs: [protocol-spec-data]
touches: [plugin/spec/fragments/, plugin/src/protocol/instructions.ts, plugin/src/pane/view.ts, plugin/hooks/register.tsx, plugin/test/unit/protocol/instructions.test.ts, plugin/test/unit/pane/view.test.ts]
---

# The protocol's prose rules are Markdown fragments, and the prompt.context instructions and a derived SKILL.md are assembled from them

- **What the fragments hold.** The rules a parser can't check, such as:
  - a progress update is one line whose state emoji show what is done, running and next;
  - each item's bold summary reads alone, and a Decide option says its pros and cons;
  - an answer that asks a question is answered in its item and restated, never taken as a choice;
  - when the 📌 roll-up is written in full and when as a count line.
- **Beside the spec.** The fragments sit in `plugin/spec/fragments/`, beside the spec ([protocol-spec-data](../closed/protocol-spec-data.md)), one fragment per topic. A fragment names a list, glyph or command by a placeholder the assembly fills from the spec, so no fragment restates a value the spec holds.
- **Two outputs, one assembly.** A pure function in `plugin/src/` assembles the fragments and the spec's values into text:
  - `instructions.ts` builds the `prompt.context` block from them, the turn-response format and the plugin's own tools together, so a session with the plugin and no skill learns the whole format;
  - the derived skill's build ([derived-skill-package](derived-skill-package.md)) assembles SKILL.md from the same fragments.
- **The plugin's own words too.** Text in the core and the hooks that names a list or a kind in words, such as the tool's description, the pane's title and messages in `view.ts`, and the labels in `register.tsx`, takes the name from the spec, so the end state's search finds no header left in it.
- **No I/O in the core.** The spec's build step writes the fragments into its generated TypeScript module as strings, so the core imports them as it imports the spec, and the same out-of-date check covers them.

Checks:

- `instructions.test.ts` checks that the assembled block holds every fragment and every list's header from the spec;
- a test fails on a placeholder the spec has no value for, and on a fragment no output uses.
