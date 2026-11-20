---
title: The kanban turns plugin lives in its own repository, in TypeScript only, beside the kanban skill
state: approved
kind: end-state
---

# The kanban turns plugin lives in its own repository, in TypeScript only, beside the kanban skill

- **Two repositories.** The plugin is the public repository `nhooey/coding-agent-kanban-turns` holding only the TypeScript plugin, its tests and its README. `coding-agent-skills` keeps the `coding-agent-kanban-turn-responses` skill, its Python scripts and its tests, and holds no plugin and no mention of one.
- **Pure functional TypeScript.** Small pure functions over immutable data, no mutation or classes, pipelines over loops, a single exit per function, effects kept at the hook edges, and well-known libraries over hand-rolled code, enforced by a linter where one fits; the same style dendrometer's plan instructions ask of its Rust and Swift.
- **The plugin works beside the skill.** The `coding-agent-kanban-turn-responses` skill gives the agent the turn-response format and the agent writes every list in its reply; the plugin adds the Decide buttons, the pane and the count line above the prompt, tells the agent of its own tool, and reads the transcript itself, with no Python and no file from the skill's repository.
- **The two are kept in step by agents, not by code.** Each repository's `AGENTS.md` names the other and says which rules they share: the 8 lists, the item references `<turn>.<List>.<n>[.<letters>][: note]`, and what settles an item. A change to one of those rules in either repository comes with a pull request to the other.
- **The interaction is [kanban-answers-in-transcript](kanban-answers-in-transcript.md).**

Checks: the plugin's repository builds and tests with no Python on the path; a Claude Code session with the plugin and the skill installed gets Decide buttons under each reply that has Decide items, the pane listing them, and the skill's count line above the prompt; `coding-agent-skills` has no `plugins/coding-agent-kanban-answers/` and `grep -r kanban_options skills/` finds nothing.
