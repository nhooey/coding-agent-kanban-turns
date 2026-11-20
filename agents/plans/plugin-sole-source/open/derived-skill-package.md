---
title: packages.skill derives the skill's SKILL.md, examples and scripts from the plugin, and a flake check builds it
state: approved
kind: implementation
part-of: plugin-sole-source
needs: [protocol-prose-fragments, protocol-golden-cases, kanban-cli-adapter]
touches: [flake.nix, plugin/spec/, nix/]
---

# packages.skill derives the skill's SKILL.md, examples and scripts from the plugin, and a flake check builds it

- **What it builds.** A flake output, `packages.skill`, holding a skill folder:
  - `SKILL.md`, assembled from the prose fragments and the spec's JSON copy ([protocol-prose-fragments](protocol-prose-fragments.md), [protocol-spec-data](protocol-spec-data.md)), with frontmatter in the form skills take;
  - worked examples rendered from chosen golden cases ([protocol-golden-cases](protocol-golden-cases.md));
  - the scripts: `kanban.js` and the standalone binaries from [kanban-cli-adapter](kanban-cli-adapter.md), with SKILL.md telling the agent to run `kanban.js` under Node where it can and a binary otherwise, passing its harness's transcript or neutral turns on stdin.
- **Deterministic.** The build reads only the repository, so one commit always gives the same skill, byte for byte.
- **Checked.** `checks.skill` builds it, so `nix flake check` fails on a plugin change that breaks the skill.
- **Consumable.** The output is a plain skill folder that skillspkgs or a skills-devshell can install, as the sessions in [kanban-skill-retired](kanban-skill-retired.md) do.

Checks:

- `nix flake check` builds `packages.skill`, and two builds of one commit give the same output hash;
- the built SKILL.md holds every list header from the spec and every fragment, and its scripts run the golden cases.
