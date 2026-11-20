---
title: The protocol's checkable rules are one YAML spec, compiled at build time into a typed module the core reads
state: approved
kind: implementation
part-of: plugin-sole-source
touches: [plugin/spec/, plugin/src/transcript.ts, plugin/src/outstanding.ts, plugin/src/answers.ts, plugin/src/items.ts, plugin/src/view.ts, plugin/src/instructions.ts, plugin/types/index.d.ts, plugin/test/, plugin/package.json, plugin/package-lock.json, flake.nix]
---

# The protocol's checkable rules are one YAML spec, compiled at build time into a typed module the core reads

- **What the spec holds.** Every rule now hard-coded in `plugin/src/`:
  - the 9 lists: each one's glyph, header and place in the order, and whether it rolls up under 📌;
  - the Decide option kinds (radio, checkbox, binary), their glyphs and their letters;
  - the commands, `open` and `reassess`, their synonyms, and the rule that a prefix naming one command alone runs it;
  - each list's settling words;
  - the pieces of the reference grammar, `<turn>.<List>.<n>[.<letters>][: note]`: the turn id's length and alphabet, the list names, the letter ranges;
  - the header underline and topic underline characters, and the separator line.
- **Separate from user preferences.** The spec is the protocol, the same for every user, and no settings file overrides it. The settings file ([yaml-data-and-settings](yaml-data-and-settings.md)) keeps holding only preferences, such as keys and layout.
- **One YAML file, read strictly.** The spec is `plugin/spec/kanban.yaml`, with its schema beside it. A build step reads it with a well-known YAML library under the YAML 1.2 core schema, so no value is typed implicitly (no `no` read as false, no `1.10` read as a number), refuses duplicate keys, and validates it against the schema.
- **Generated, typed and readonly.** The build step writes two files, committed beside their source, each with a header naming it:
  - a TypeScript module in `plugin/src/` exporting the spec as one `as const`, deeply readonly value with its type;
  - a JSON copy, for readers that aren't TypeScript, such as the derived skill's build ([derived-skill-package](derived-skill-package.md)).
- **The core imports only the generated module.** Each function in `plugin/src/` that now names a glyph, word or character takes it from that module's value instead, and the plugin and its tests import nothing else of the spec. The core stays pure: no file is read at run time, and no YAML library is loaded at run time for the spec.
- **Out of date fails.** A flake check runs the build step and fails when the committed TypeScript module or JSON copy differs from what it writes.
- **Rules from the pane-every-list plan land here.** The settling words and the grouped answer syntax that [kanban-skill-list-answers](../../pane-every-list/open/kanban-skill-list-answers.md) and [answers-grouped-by-turn-and-list](../../pane-every-list/open/answers-grouped-by-turn-and-list.md) add are written into the spec, so those nodes come after this one.

Checks:

- a test in `plugin/test/` checks the spec's own consistency: 9 lists, unique glyphs and headers, no word that settles two lists differently, no command prefix shared by two commands' names;
- a test feeds the build step a spec with an implicitly typed scalar, a duplicate key and a schema violation, and each is refused;
- the existing tests in `plugin/test/` pass unchanged, with the core reading the generated module;
- `nix flake check` fails on a hand edit of either generated file;
- the search in [the end state](plugin-sole-source.md)'s checks finds no rule left in `plugin/src/` outside the generated module.
