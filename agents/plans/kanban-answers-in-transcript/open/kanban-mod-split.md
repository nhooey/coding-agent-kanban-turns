---
title: Move the mod to its own repository with its history, and take it out of coding-agent-skills
state: in-progress
kind: implementation
part-of: kanban-mod-own-repository
touches:
  [
    plugins/coding-agent-kanban-answers,
    skills/coding-agent-kanban-turn-responses,
    scripts/skills_dev.py,
    AGENTS.md,
  ]
---

# Move the mod to its own repository with its history, and take it out of coding-agent-skills

- Split `plugins/coding-agent-kanban-answers/` into the new repository with `git subtree split`, so its commits come along, then add its own `flake.nix`, dev shell, `AGENTS.md` and marketplace entry.
- In `coding-agent-skills`: remove the folder, the "Buttons for the options" paragraph from the skill's SKILL.md, and the mod's mentions in `commands.md` and `scripts.md`; `skills-dev mods` keeps working for the other mods, if any remain.
- Both `AGENTS.md` files gain the paragraph on keeping the shared rules in step.
