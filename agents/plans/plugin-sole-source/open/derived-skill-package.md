---
title: packages.plugin carries a skill derived from the plugin, its SKILL.md, examples and scripts, under skills/, and a flake check confirms it
state: approved
kind: implementation
part-of: plugin-sole-source
needs: [protocol-prose-fragments, protocol-golden-cases, kanban-cli-adapter]
touches: [flake.nix, plugin/spec/, nix/]
---

# packages.plugin carries a skill derived from the plugin, its SKILL.md, examples and scripts, under skills/, and a flake check confirms it

- **Ships inside the plugin.** `packages.plugin` holds the skill at `skills/coding-agent-kanban-turn-responses/`, beside the manifest and the hooks, so installing the plugin installs the skill. Claude Code loads it as `coding-agent-kanban-turns:coding-agent-kanban-turn-responses`.
- **A fallback for the hooks.** When the plugin's hooks fail to load, the skill still teaches the format and runs the protocol. When both load, the agent gets the instructions once ([instructions-once-with-skill](instructions-once-with-skill.md)).
- **What the skill folder holds,** all built from the repository at build time:
  - `SKILL.md`, assembled from the prose fragments and the spec's JSON copy ([protocol-prose-fragments](protocol-prose-fragments.md), [protocol-spec-data](protocol-spec-data.md)), with frontmatter in the form skills take, its `name` the folder's;
  - worked examples rendered from chosen golden cases ([protocol-golden-cases](protocol-golden-cases.md));
  - `scripts/`: the CLI from [kanban-cli-adapter](kanban-cli-adapter.md), `kanban.js` and the standalone binary for the platform the plugin is built for.
- **The fallback runs the plugin's core.** SKILL.md tells the agent to run `scripts/kanban.js` under Node where it can, and the binary otherwise, passing the transcript's path or neutral turns on stdin. Both are the same core functions the hooks call, bundled, so the fallback can't count, roll up or lint differently from the plugin.
- **One derivation, two places.** The skill folder is built once, as its own derivation, and `packages.plugin` copies it into `skills/`.
- **A skill-only output for harnesses without plugins.** The same derivation is exposed as `packages.skill-standalone`, a plain skill folder that skillspkgs or a skills-devshell can install for a harness that loads skills but not Claude Code plugins.
  - It's kept because the harness-neutral core ([neutral-turn-stream](neutral-turn-stream.md)) and the CLI's stdin input ([kanban-cli-adapter](kanban-cli-adapter.md)) exist for those harnesses, and without an installable skill they'd have nothing to run them.
  - Exposing it costs one attribute, since the plugin builds the same derivation, and the two can't differ.
  - It's secondary: nothing in a Claude Code session installs it beside the plugin, where it would load a second copy of the instructions under an unprefixed name.
- **Deterministic.** The build reads only the repository, so one commit always gives the same plugin, skill included, byte for byte.

Checks:

- `checks.plugin` builds `packages.plugin` and confirms `skills/coding-agent-kanban-turn-responses/SKILL.md` and its `scripts/kanban.js` are in it;
- a flake check runs `claude plugin validate` on the built plugin, which accepts it with the skill in place. It takes the `claude` CLI from nixpkgs' `claude-code`; if that CLI can't validate offline inside the build sandbox, the check moves to the dev shell's `plugin-test`, and the node says so;
- two builds of one commit give the same output hash;
- the built SKILL.md holds every list header from the spec and every fragment, and its scripts run the golden cases;
- `packages.skill-standalone` is the same store path as the plugin's `skills/coding-agent-kanban-turn-responses/` source.
