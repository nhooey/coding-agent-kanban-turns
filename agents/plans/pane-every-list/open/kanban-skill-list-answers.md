---
title: The kanban skill reads each list's settling words and the grouped answer syntax
state: approved
kind: implementation
part-of: pane-every-list
needs: [protocol-spec-data]
touches: [coding-agent-skills/skills/coding-agent-kanban-turn-responses/SKILL.md, coding-agent-skills/skills/coding-agent-kanban-turn-responses/scripts/reply_turns.py, coding-agent-skills/skills/coding-agent-kanban-turn-responses/scripts/outstanding.py, coding-agent-skills/AGENTS.md]
---

# The kanban skill reads each list's settling words and the grouped answer syntax

A pull request to `nhooey/coding-agent-skills`, the matching half of the rules the plugin shares with the `coding-agent-kanban-turn-responses` skill.

- **Settling words.** The skill says which word after an item's reference settles it, and the session acts on it:
  - 👉 Todo: `done` and `skip`;
  - 🔍 Review: `reviewed` and `skip` settle it; `merge` asks the agent to merge the item's pull request, and the item settles once it merges;
  - ⏳ Waiting: `stop`, and the session stops waiting on it;
  - 🔑 Authorizations: `allow` grants it and `deny` withdraws it.

  A word stands alone after `: `, or is followed by `: ` and a note, `Todo.3: done: rotated it yesterday`. Any other text after `: ` is a note, which settles a Decide item, as an answer in words does today, and no other list's item.
- **Grouped answers.** A line `<turn>.<List>` opens a group, and each indented line under it answers an item of that turn and list: `<n>[.<letters>][ (<context>)][: <word or note>]`. The parenthesised context is skipped. The first line `coding-agent-kanban-turns@nix-pinned:` and a trailing `reassess` line are read as the plugin writes them.
- **Plain references stay valid**, in a group's draft and on their own.
- **Both scripts read it.** `reply_turns.py` and `outstanding.py` parse grouped answers and the words, so the 📌 roll-up and count line leave out what they settle.
- **The shared rules are named.** `coding-agent-skills`'s `AGENTS.md` lists the words and the grouped syntax among the rules shared with this repository.

Checks: `test_reply_turns.py` and `test_outstanding.py` cover the grouped example in [the end state](pane-every-list.md), each word on each list, a group line beside a numbered answer such as `2. B`, which still answers the turn before, and a plain reference; the skill's lint and tests pass.
