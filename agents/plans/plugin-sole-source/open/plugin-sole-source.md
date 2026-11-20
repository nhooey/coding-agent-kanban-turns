---
title: The plugin is the only source of the kanban turn-response protocol, and carries a skill derived from it, built deterministically
state: approved
kind: end-state
---

# The plugin is the only source of the kanban turn-response protocol, and carries a skill derived from it, built deterministically

- **One source.** Every rule of the kanban turn-response protocol lives in this repository and nowhere else:
  - the 9 lists, their glyphs, headers and order, and which roll up under 📌;
  - the Decide options' kinds and letters;
  - the commands, their synonyms and the prefix rule;
  - each list's settling words;
  - the item reference grammar, `<turn>.<List>.<n>[.<letters>][: note]`;
  - the underline and separator characters;
  - the prose rules a parser can't check.
- **Rules are data, read by code.** In `plugin/spec/`:
  - the checkable rules are `kanban.yaml`, compiled at build time into a typed readonly TypeScript module and a JSON copy ([protocol-spec-data](protocol-spec-data.md));
  - the prose rules are Markdown fragments ([protocol-prose-fragments](protocol-prose-fragments.md));
  - the expected behaviour is golden cases in YAML ([protocol-golden-cases](protocol-golden-cases.md)).

  The plugin's core, its `prompt.context` instructions and the derived skill all read these, so none restates a rule by hand.
- **Data and settings are YAML** throughout the repository, the user's settings in `config.yaml` among them, read by a well-known YAML library ([yaml-data-and-settings](../closed/yaml-data-and-settings.md)).
- **The plugin teaches the format.** With the plugin's hooks loaded, the agent learns the format from the instructions the plugin sends once per conversation ([prompt-context-hook-runs](../closed/prompt-context-hook-runs.md)), and the plugin's own tools and `turn.complete` hook do what the skill's scripts did ([plugin-tools-replace-skill-scripts](plugin-tools-replace-skill-scripts.md)).
- **Harness-neutral core.** The core works on neutral turns ([neutral-turn-stream](neutral-turn-stream.md)); Claude Code's JSONL transcript is one adapter, and a CLI over the core ([kanban-cli-adapter](kanban-cli-adapter.md)) serves any harness that can run a command.
- **The plugin carries a derived skill that follows every change** ([derived-skill-package](derived-skill-package.md)):
  - `packages.plugin` holds a SKILL.md, its examples and its scripts under `skills/`, built from the spec, the fragments, the golden cases and the CLI, and Claude Code loads it as `coding-agent-kanban-turns:coding-agent-kanban-turn-responses`;
  - installing the plugin installs the skill, the fallback when the plugin's hooks fail to load;
  - its scripts are the CLI, `kanban.js` under Node or a standalone binary, so the fallback runs the same core functions as the hooks;
  - the same skill folder is `packages.skill-standalone`, for a harness that loads skills but not plugins;
  - the same commit always builds the same plugin, skill included, and a flake check builds it, so a plugin change that breaks the skill fails `nix flake check`.
- **Instructions arrive once.** With the hooks and the skill both loaded, the agent gets the protocol's instructions once ([instructions-once-with-skill](instructions-once-with-skill.md)).
- **The old skill is retired** ([kanban-skill-retired](kanban-skill-retired.md)): `coding-agent-kanban-turn-responses` in `coding-agent-skills` is marked retired, no skills-devshell, user-level install or session installs it, and `AGENTS.md` names no rules kept in step with another repository.

Checks:

- a search of `plugin/src/` finds no list glyph, header, command name, settling word or rule character outside the module the spec compiles to;
- `nix flake check` fails when that module or the spec's JSON copy is out of date;
- `nix flake check` builds `packages.plugin` with its skill under `skills/`, and two builds of one commit give the same output;
- a session with the plugin's hooks and its skill both loaded gets the instructions once;
- a Claude Code session with the plugin and without the old skill writes replies in the kanban shape, and the plugin's lint finds nothing in them.
