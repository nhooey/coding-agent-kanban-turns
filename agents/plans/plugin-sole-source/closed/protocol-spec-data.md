---
title: The protocol's checkable rules are one YAML spec, compiled at build time into a typed module the core reads
state: implemented
kind: implementation
part-of: plugin-sole-source
touches: [plugin/spec/, plugin/tools/, plugin/src/spec.ts, plugin/src/protocol.ts, plugin/src/transcript.ts, plugin/src/outstanding.ts, plugin/src/answer-lines.ts, plugin/src/answers.ts, plugin/src/items.ts, plugin/src/links.ts, plugin/src/sections.ts, plugin/src/view.ts, plugin/src/instructions.ts, plugin/hooks/register.tsx, plugin/test/, plugin/package.json, plugin/package-lock.json, flake.nix, AGENTS.md, README.md]
---

# The protocol's checkable rules are one YAML spec, compiled at build time into a typed module the core reads

- **What the spec holds.** Every rule now hard-coded in `plugin/src/`:
  - the 9 lists: each one's glyph, header and place in the order, and whether it rolls up under 📌;
  - the Decide option kinds (radio, checkbox, binary), their glyphs and their letters;
  - the commands, `open` and `reassess`, their synonyms, and the rule that a prefix naming one command alone runs it;
  - each list's settling words, a map per list from word to what it does, which [kanban-skill-list-answers](../../pane-every-list/open/kanban-skill-list-answers.md) fills;
  - the pieces of the reference grammar, `<turn>.<List>.<n>[.<letters>][: note]`: the turn id's length, shortest prefix and alphabet, the list names, the letter ranges, and the words, `of` and `from`, that name an answer's turn after it;
  - the 📌 roll-up's glyph, headers and count line, and the 🔖 tag's glyph and subscript digits;
  - the header, roll-up and topic underline characters, and the separator line.
- **Separate from user preferences.** The spec is the protocol, the same for every user, and no settings file overrides it. The settings file ([yaml-data-and-settings](yaml-data-and-settings.md)) keeps holding only preferences, such as keys and layout.
- **One YAML file, read strictly.** The spec is `plugin/spec/kanban.yaml`, with its JSON Schema beside it, `kanban.schema.yaml`. The build step, `plugin/tools/spec.ts` run by `plugin/tools/compile-spec.ts`, reads both with the core's `parseYaml`, under the YAML 1.2 core schema, so `no`, `Y` and `N` are strings, and refuses duplicate keys. It validates the spec against the schema with ajv; the schema types every value, so a plain scalar the core schema reads as a number or a boolean, such as `1.10` or `true`, where a string belongs is refused. It refuses an empty schema, which would check nothing. It then checks what no schema can state:
  - 9 lists, unique glyphs and names, and no word settling two lists differently;
  - no command name starting another command's;
  - a turn id's shortest prefix no longer than the turn id;
  - a letter range that runs forwards, and holds every option kind's letters;
  - no glyph shared by two option kinds.
- **Generated, typed and readonly.** The build step writes two files, committed, each with a header naming its source and the command that writes it, `spec-build`:
  - `plugin/src/spec.ts`, exporting the spec as one `as const`, deeply readonly value, `SPEC`, and its type, `Spec`;
  - `plugin/spec/kanban.json`, beside the spec, its header in `$comment`, for readers that aren't TypeScript, such as the derived skill's build ([derived-skill-package](derived-skill-package.md)).
- **The core imports only the generated module.** Each function in `plugin/src/` that named a glyph, word or character takes it from that module's value instead, directly or through `plugin/src/protocol.ts`, which derives the patterns and labels several core files share. The plugin and its tests import nothing else of the spec. The core stays pure: no file is read at run time, and no YAML library is loaded at run time for the spec.
- **Prose comes later.** Prose that names a list or a kind in words, such as the instructions, the tool's description and the pane's messages, keeps its words until [protocol-prose-fragments](protocol-prose-fragments.md) assembles it from the spec. Where prose states a value a rule rests on, such as the turn id's length, it reads that value from the spec now.
- **Out of date fails.** `checks.spec` runs the build step with `--check` and fails when the committed TypeScript module or JSON copy differs from what it writes.
- **Rules from the pane-every-list plan land here.** [kanban-skill-list-answers](../../pane-every-list/open/kanban-skill-list-answers.md) writes the settling words and the grouped answer syntax into the spec, once the old skill is retired, and [answers-grouped-by-turn-and-list](../../pane-every-list/open/answers-grouped-by-turn-and-list.md) reads them from it, so those nodes come after this one.

Checks:

- a test in `plugin/test/` checks the spec's own consistency: 9 lists, unique glyphs and headers, no word that settles two lists differently, no command name that starts another's, and the turn id, letter and option-glyph checks above;
- a test feeds the build step a spec with an implicitly typed scalar, a duplicate key and a schema violation, and each is refused;
- the existing tests in `plugin/test/` pass unchanged, with the core reading the generated module;
- `nix flake check` fails on a hand edit of either generated file;
- the search in [the end state](../open/plugin-sole-source.md)'s checks finds no rule left in a pattern or a parser in `plugin/src/` outside the generated module; prose is left to [protocol-prose-fragments](protocol-prose-fragments.md).
