---
title: No code is kept for an older setting, reply or stored shape
state: proposed
kind: implementation
part-of: items-events-views-refactor
touches: [plugin/src/config/config.ts, plugin/defaults/config.yaml, plugin/spec/kanban.yaml, plugin/spec/kanban.schema.yaml, plugin/spec/fragments/, plugin/spec/cases/, plugin/src/protocol/, plugin/src/lint/reply.ts, plugin/tools/spec/load.ts, plugin/tools/skill/render.ts, plugin/hooks/register.tsx, plugin/test/unit/, README.md, AGENTS.md]
---

# No code is kept for an older setting, reply or stored shape

The plugin has one user, so nothing has to keep working for an install, a transcript or a settings file from before a change.
Code that exists only for one is deleted before the item model is built, so the model isn't built round it and the spec it extends is smaller.

## What goes

- **Retired settings.**
  `RETIRED` in `plugin/src/config/config.ts`, with `withoutRetired`, `retiredIn` and the warnings they make, for `outstanding`, `colors.title`, `colors.expand`, `colors.close-x` and `pane.hints`.
  A settings file that holds one of them is refused as a file with any unknown key is.
- **Names older replies carry.**
  Each list's `aliases` and the roll-up's `aliases` in `plugin/spec/kanban.yaml`, and every reader of them.
- **The option kind the instructions don't teach.**
  The `binary` kind, 👍 Y and 👎 N, with the `taught` flag every kind carries for its sake, the lint's `untaught-option` rule, the prose values for untaught kinds, and the skill build's refusal of an example that draws one.
  Every kind in the spec is taught, so nothing says so.
- **Stored shapes.**
  No code converts or reads a value an older build stored: an atom's shape tag declines it, and that is the whole of it.
- **The docs.**
  `README.md` and `AGENTS.md` say nothing of a retired setting, an alias or an untaught kind.

## What it leaves

- The old skill installed by `nix/skills-devshell`, which [kanban-skill-retired](../../plugin-sole-source/open/kanban-skill-retired.md) removes.
- The lists themselves and their readers, which [reply-prose-readers-retired](../../items-events-views/open/reply-prose-readers-retired.md) deletes once the item model has replaced them.
- The commands' synonyms, which are for typing and not for an older build.

Checks:

- a search of `plugin/` outside the generated files and `plugin/skills/` finds no `RETIRED`, no `aliases` key, no `taught` and no `untaught`;
- a test that a settings file holding `pane.hints` is refused, by the unknown key's own message;
- the golden cases that exercised an alias or a 👍 option are gone, and the rest pass through the core and the CLI;
- the generated spec module, its JSON copy and the committed skill are up to date, and `nix flake check` passes;
- `typecheck-plugin` and `plugin-test` pass in the dev shell.
