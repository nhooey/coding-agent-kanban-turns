---
title: The coding-agent-kanban-turn-responses skill is retired, and no repository or session installs it
state: approved
kind: implementation
part-of: plugin-sole-source
needs: [protocol-spec-data, protocol-prose-fragments, protocol-golden-cases, neutral-turn-stream, kanban-cli-adapter, plugin-tools-replace-skill-scripts, derived-skill-package, prompt-context-hook-runs]
touches: [AGENTS.md, skills-devshell/flake.nix, skills-devshell/flake.lock]
---

# The coding-agent-kanban-turn-responses skill is retired, and no repository or session installs it

Done after the derived skill ([derived-skill-package](derived-skill-package.md)) is in use, so no session is left without the format.

- **`AGENTS.md`.** The "Rules shared with the kanban skill" section is rewritten: the plugin is the only source of the protocol, the spec, fragments and golden cases in `plugin/spec/` hold it, and `packages.skill` derives a skill from them. No rule is kept in step with another repository.
- **This repository's skills-devshell** no longer installs `coding-agent-kanban-turn-responses`.
- **MyNixOS's sessions** no longer install it; they get the format from the plugin, or from the derived skill where the plugin isn't loaded.
- **`coding-agent-skills`** marks the skill retired, naming this repository's `packages.skill` as its replacement, in a pull request there.

Checks:

- `skills-devshell/flake.nix` names no `coding-agent-kanban-turn-responses`, and `.agents/skills/` has no copy;
- `AGENTS.md` has no section about rules shared with the kanban skill;
- a session in a repository with the plugin and without the old skill writes replies in the kanban shape.
