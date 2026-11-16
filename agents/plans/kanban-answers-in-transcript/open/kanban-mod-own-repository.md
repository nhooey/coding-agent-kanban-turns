---
title: The kanban answers mod lives in its own repository, in TypeScript only, and replaces the kanban skill where it's installed
state: approved
kind: end-state
---

# The kanban answers mod lives in its own repository, in TypeScript only, and replaces the kanban skill where it's installed

- **Two repositories.** The mod is the public repository `nhooey/claude-code-kanban-turns` holding only the TypeScript mod, its tests and its README. `coding-agent-skills` keeps the `coding-agent-kanban-turn-responses` skill, its Python scripts and its tests, and holds no mod and no mention of one.
- **Pure functional TypeScript.** Small pure functions over immutable data, no mutation or classes, pipelines over loops, a single exit per function, effects kept at the hook edges, and well-known libraries over hand-rolled code, enforced by a linter where one fits; the same style `opsofteng-functional-programmer` and dendrometer's plan instructions ask of its Rust and Swift.
- **The mod needs no skill.** Where the mod is installed, the kanban skill isn't installed or loaded. The mod gives the agent the turn-response format itself, reads the transcript itself and works out what's open itself, with no Python and no file from the skill's repository.
- **The two are kept in step by agents, not by code.** Each repository's `AGENTS.md` names the other and says which rules they share: the 8 lists, the item references `<turn>.<List>.<n>[.<letters>][: note]`, and what settles an item. A change to one of those rules in either repository comes with a pull request to the other.
- **The interaction is [kanban-answers-in-transcript](kanban-answers-in-transcript.md).**

Checks: the mod's repository builds and tests with no Python on the path; a Claude Code session with only the mod installed gets replies whose items are in the tool row and a band that lists them; `coding-agent-skills` has no `plugins/coding-agent-kanban-answers/` and `grep -r kanban_options skills/` finds nothing.
