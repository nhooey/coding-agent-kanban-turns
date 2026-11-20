---
title: The plugin's kanban_outstanding and kanban_lint tools, and its turn.complete reply lint, do what the skill's scripts did
state: approved
kind: implementation
part-of: plugin-sole-source
needs: [protocol-spec-data, protocol-golden-cases]
touches: [plugin/src/, plugin/hooks/register.tsx, plugin/src/instructions.ts, plugin/plugin-tests/, plugin/test/]
---

# The plugin's kanban_outstanding and kanban_lint tools, and its turn.complete reply lint, do what the skill's scripts did

- **`kanban_outstanding`.** A plugin tool giving the agent the open items, the count line and the roll-up for this session, in place of the skill's `outstanding.py`, including the Decide items' JSON that `kanban_options` takes.
- **`kanban_lint`.** A plugin tool that lints a draft reply against the spec, in place of the skill's `lint_reply.py`: bold summaries, separators, options, header underlines and table placement.
- **The reply lint runs itself.** The plugin's `turn.complete` hook lints the final reply and gives its findings back to the agent, so no script path or skill hook is needed.
- **Pure lint.** The lint is a pure function in `plugin/src/` over the spec ([protocol-spec-data](../closed/protocol-spec-data.md)); the tools and the hook are its edges.
- **The instructions name the tools.** `prompt.context`'s block tells the agent when to call each, in place of the skill's script paths.

Checks:

- the lint expectations in the golden cases ([protocol-golden-cases](protocol-golden-cases.md)) pass;
- an engine test in `plugin/plugin-tests/` for each tool and for the `turn.complete` lint;
- `typecheck-plugin` and `plugin-test` pass.
