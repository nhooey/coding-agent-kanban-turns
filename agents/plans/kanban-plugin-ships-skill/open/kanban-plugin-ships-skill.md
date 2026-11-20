---
title: The kanban plugin ships the kanban turn responses skill, so a repository needs no skills-devshell copy of it
state: approved
kind: end-state
---

# The kanban plugin ships the kanban turn responses skill, so a repository needs no skills-devshell copy of it

- **One install gives both.** The `coding-agent-kanban-turns` plugin carries the `coding-agent-kanban-turn-responses` skill in its own `skills/` folder, so a Claude Code session with the plugin installed gets the turn-response format, the Decide buttons, the pane and the count line from that one install.
- **The skill is still written in `coding-agent-skills`.** The plugin's Nix build takes the skill from a pinned `coding-agent-skills` input and copies it into the built plugin, scripts and all. Nothing is copied into this repository by hand. skillspkgs keeps packaging the skill for sessions and agents without the plugin.
- **The two stay in step through the pin.** Bumping the input brings a skill change into the plugin. The rules the two share are kept in step as [kanban-mod-own-repository](../../kanban-answers-in-transcript/open/kanban-mod-own-repository.md) says.
- **skills-devshells drop their copy.** Once a release of the plugin with the skill is installed, as `coding-agent-kanban-turns@nix-pinned`, each repository's `skills-devshell/` stops installing `coding-agent-kanban-turn-responses`. The first is tried on the MyNixOS configuration's repository, and the rest follow only once a session there still writes kanban turn responses.
- **No skill twice.** A session never loads the skill from both the plugin and `.agents/skills/`, and the plugin's skill is the one the reply lint hook and the scripts' paths find.

Checks:
- `plugin-build`'s `result-plugin` holds `skills/coding-agent-kanban-turn-responses/SKILL.md` and its scripts;
- in a repository whose skills-devshell no longer installs the skill, a session with the plugin lists the skill once, writes its replies in the kanban shape, and `lint_reply.py` runs from the plugin's copy.
