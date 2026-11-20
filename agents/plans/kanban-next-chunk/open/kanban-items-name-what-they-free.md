---
title: Each item that blocks other work names the items it frees, by reference
state: approved
kind: implementation
part-of: kanban-next-chunk
needs: [protocol-spec-data, protocol-prose-fragments]
touches: [plugin/spec/kanban.yaml, plugin/spec/fragments/, plugin/spec/cases/, plugin/src/transcript/turns.ts, plugin/src/protocol/instructions.ts, plugin/test/unit/]
---

# Each item that blocks other work names the items it frees, by reference

- **The rule is in the spec.** `plugin/spec/kanban.yaml` gives the line's grammar: an item's last line may be `Frees: <ref>, <ref>`, each ref an item of this or an earlier turn ([protocol-spec-data](../../plugin-sole-source/closed/protocol-spec-data.md)).
- **The prose says when to write it.** A prose fragment tells the agent to end an item that blocks other work with its `Frees:` line, in place of saying what it frees in words ([protocol-prose-fragments](../../plugin-sole-source/open/protocol-prose-fragments.md)), so the `prompt.context` instructions and the derived skill both carry it.
- **The core reads it.** The plugin's transcript reader reads the line into a `frees` list on each item, by the spec's grammar.
- **`kanban_options` takes an optional `frees`** on each Decide item.

No pull request goes to coding-agent-skills: the spec is the only statement of the rule.

Checks: golden cases with `Frees:` lines on items of several lists, giving each item's `frees`, and one with a ref to an unknown item; the assembled instructions hold the fragment.
