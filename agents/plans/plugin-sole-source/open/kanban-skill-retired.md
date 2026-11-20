---
title: The coding-agent-kanban-turn-responses skill is retired, and no repository or session installs it
state: approved
kind: implementation
part-of: plugin-sole-source
needs: [protocol-spec-data, protocol-prose-fragments, protocol-golden-cases, neutral-turn-stream, kanban-cli-adapter, plugin-tools-replace-skill-scripts, derived-skill-package, instructions-once-with-skill, prompt-context-hook-runs]
touches: [AGENTS.md, skills-devshell/flake.nix, skills-devshell/flake.lock]
---

# The coding-agent-kanban-turn-responses skill is retired, and no repository or session installs it

Done once the plugin carries its own skill ([derived-skill-package](derived-skill-package.md)) and is in use, so no session is left without the format. A copy of the old skill left installed beside the plugin would load a second set of instructions under the unprefixed name, which [instructions-once-with-skill](instructions-once-with-skill.md) doesn't recognise as the plugin's.

- **`AGENTS.md`.** The "Rules shared with the kanban skill" section is rewritten: the plugin is the only source of the protocol, the spec, fragments and golden cases in `plugin/spec/` hold it, and the plugin builds its skill from them. No rule is kept in step with another repository.
- **The project-level install is gone.** This repository's skills-devshell no longer installs `coding-agent-kanban-turn-responses`, so `.agents/skills/` holds no copy.
- **The user-level install is gone.** `~/.claude/skills/coding-agent-kanban-turn-responses` is removed, through the MyNixOS configuration that installs it. A user-level instruction to load the skill at every turn, such as one in `~/.claude/CLAUDE.md`, names the plugin's `coding-agent-kanban-turns:coding-agent-kanban-turn-responses` or is dropped.
- **MyNixOS's sessions** get the format from the plugin's hooks, or from the plugin's skill where the hooks don't load. A harness that loads skills but not Claude Code plugins installs `packages.skill-standalone`.
- **`coding-agent-skills`** marks the skill retired, naming this repository's plugin, and its skill, as the replacement, in a pull request there.

Checks:

- `skills-devshell/flake.nix` names no `coding-agent-kanban-turn-responses`, and `.agents/skills/` has no copy;
- `~/.claude/skills/` has no `coding-agent-kanban-turn-responses` on a machine MyNixOS configures;
- `AGENTS.md` has no section about rules shared with the kanban skill;
- a session in a repository with the plugin and without the old skill writes replies in the kanban shape.
