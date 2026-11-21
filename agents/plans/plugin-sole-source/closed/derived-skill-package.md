---
title: packages.plugin carries a skill derived from the plugin, its SKILL.md, examples and scripts, under skills/, and a flake check confirms it
state: implemented
kind: implementation
part-of: plugin-sole-source
needs: [protocol-prose-fragments, protocol-golden-cases, kanban-cli-adapter]
touches: [flake.nix, plugin/spec/, plugin/tools/skill/, plugin/skills/, nix/]
implemented-by: derived-skill-package
---

# packages.plugin carries a skill derived from the plugin, its SKILL.md, examples and scripts, under skills/, and a flake check confirms it

- **Ships inside the plugin.** `packages.plugin` holds the skill at `skills/coding-agent-kanban-turn-responses/`, the spec's `skill.name`, beside the manifest and the hooks, so installing the plugin installs the skill. Claude Code loads it as `coding-agent-kanban-turns:coding-agent-kanban-turn-responses`, and a command after that slash command runs as it does after the skill's own.
- **A fallback for the hooks.** When the plugin's hooks fail to load, the skill still teaches the format and runs the protocol. When both load, the agent gets the instructions once ([instructions-once-with-skill](../open/instructions-once-with-skill.md)).
- **What the skill folder holds,** all built from the repository at build time:
  - `SKILL.md`, assembled from the prose fragments and filled in from the spec ([protocol-prose-fragments](protocol-prose-fragments.md), [protocol-spec-data](protocol-spec-data.md)), with frontmatter in the form skills take, its `name` the folder's;
  - worked examples rendered from the golden cases not marked `example: false` ([protocol-golden-cases](protocol-golden-cases.md)), each drawing only the option kinds the instructions teach, and giving only what a reply alone settles, since the skill teaches no call to the plugin's buttons;
  - `scripts/`: the CLI from [kanban-cli-adapter](kanban-cli-adapter.md), `kanban.js`, and in a Nix build `kanban`, a wrapper that runs it with nodejs-slim's `node`.
- **The fallback runs the plugin's core.** SKILL.md tells the agent to run `"${CLAUDE_SKILL_DIR}/scripts/kanban.js"` under Node where it can, and the wrapper otherwise. In a Claude Code session it reads the session's own transcript, by `CLAUDE_CODE_SESSION_ID`; elsewhere it takes a transcript's path or neutral turns on stdin. `due` times the roll-up interval from the turns' times. All are the same core functions the hooks call, bundled, so the fallback can't count, roll up or lint differently from the plugin.
- **One derivation, two places.** The skill folder is built once, as its own derivation, and `packages.plugin` copies it into `skills/`.
- **A copy for the git install.** The marketplace installs `./plugin` from git, with no build, so `plugin/skills/` holds the build's files but the wrapper, which names a store path: a git install's skill has `kanban.js` alone, which needs Node 20 or newer. `refresh-skill` lays the build there, and a flake check holds the whole folder to it file for file and mode for mode.
- **A skill-only output for harnesses without plugins.** The same derivation is exposed as `packages.skill-standalone`, a plain skill folder that skillspkgs or a skills-devshell can install for a harness that loads skills but not Claude Code plugins.
  - It's kept because the harness-neutral core ([neutral-turn-stream](neutral-turn-stream.md)) and the CLI's stdin input ([kanban-cli-adapter](kanban-cli-adapter.md)) exist for those harnesses, and without an installable skill they'd have nothing to run them.
  - Exposing it costs one attribute, since the plugin builds the same derivation, and the two can't differ.
  - It's secondary: nothing in a Claude Code session installs it beside the plugin, where it would load a second copy of the instructions under an unprefixed name.
- **Deterministic.** The build reads only the repository, so one commit always gives the same plugin, skill included, byte for byte; `check-reproducible` in the dev shell rebuilds each of the repository's own derivations in the plugin's closure with `nix build --rebuild` to confirm it.

Checks:

- `checks.plugin` builds `packages.plugin` and confirms `skills/coding-agent-kanban-turn-responses/SKILL.md` is in it, the folder the same as `packages.skill-standalone`, its `scripts/kanban.js` the CLI's build, and its wrapper running it;
- `checks.validate` runs `claude plugin validate` on the built plugin, which accepts it with the skill in place. It takes the `claude` CLI from nixpkgs' `claude-code`, which validates offline, and prints its log;
- the unit tests find every list header from the spec and every one of its fragments in the built SKILL.md, its description within 1024 characters; `checks.cli-js` and `checks.cli-bin` run the CLI's builds on every golden case, side by side;
- `checks.skill` holds the committed `plugin/skills/` to the build, file for file and mode for mode, and says so where the folder is missing;
- `packages.skill-standalone` is the derivation the plugin copies into `skills/coding-agent-kanban-turn-responses/`.
