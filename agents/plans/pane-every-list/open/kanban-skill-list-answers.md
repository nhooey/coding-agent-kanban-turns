---
title: The spec holds each list's settling words and the grouped answer syntax
state: approved
kind: implementation
part-of: pane-every-list
needs: [protocol-spec-data, kanban-skill-retired]
touches: [plugin/spec/kanban.yaml, plugin/spec/cases/, plugin/test/unit/]
---

# The spec holds each list's settling words and the grouped answer syntax

The settling words for every list and the grouped answer syntax are written into `plugin/spec/kanban.yaml`, the protocol's only source ([protocol-spec-data](../../plugin-sole-source/closed/protocol-spec-data.md)), and reach the core through the module the spec compiles to. No pull request goes to `coding-agent-skills`: the old skill is retired first ([kanban-skill-retired](../../plugin-sole-source/open/kanban-skill-retired.md)), and the derived skill takes the rules from the spec.

- **Settling words.** The spec says which word after an item's reference settles it, and what the session does:
  - 👉 Todo: `done` and `skip`;
  - 🔍 Review: `reviewed` and `skip` settle it; `merge` asks the agent to merge the item's pull request, and the item settles once it merges;
  - ⏳ Waiting: `stop`, and the session stops waiting on it;
  - 🔑 Authorizations: `allow` grants it and `deny` withdraws it.

  A word stands alone after `: `, or is followed by `: ` and a note, `Todo.3: done: rotated it yesterday`. Any other text after `: ` is a note, which settles a Decide item, as an answer in words does today, and no other list's item.
- **Grouped answers.** The spec's reference grammar gains the grouped form: a line `<turn>.<List>` opens a group, and each indented line under it answers an item of that turn and list, `<n>[.<letters>][ (<context>)][: <word or note>]`. The parenthesised context is skipped. The first line naming the plugin, `coding-agent-kanban-turns:` or `coding-agent-kanban-turns@<marketplace>:`, and a trailing `reassess` line are part of the form.
- **Plain references stay valid**, in a group's draft and on their own.
- **Cases show them.** The golden cases ([protocol-golden-cases](../../plugin-sole-source/closed/protocol-golden-cases.md)) gain cases for:
  - each word on each list;
  - the grouped example in [the end state](pane-every-list.md);
  - a group line beside a numbered answer such as `2. B`, which still answers the turn before;
  - a plain reference.

  They pass once [items-of-every-list](items-of-every-list.md) and [answers-grouped-by-turn-and-list](answers-grouped-by-turn-and-list.md) read the words and the grouped form, and the derived skill's examples show them.

Checks: the spec's consistency test covers each word and finds no word that settles two lists differently; the generated module and JSON copy are up to date; the new cases are in `plugin/spec/cases/`.
