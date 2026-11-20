---
title: The repository's data and settings files are YAML, read by a well-known YAML library the built plugin carries
state: implemented
kind: implementation
part-of: plugin-sole-source
touches: [plugin/defaults/, plugin/src/config.ts, plugin/hooks/settings.ts, plugin/test/config.test.ts, plugin/test/vendor-types.ts, plugin/vendor/, plugin/plugin-tests/pane.test.tsx, plugin/tools/plugin-test.sh, plugin/package.json, plugin/package-lock.json, nix/, flake.nix, .gitignore, AGENTS.md, README.md]
---

# The repository's data and settings files are YAML, read by a well-known YAML library the built plugin carries

- **Settings are YAML.**
  - The shipped defaults move from `plugin/defaults/config.jsonc` to `plugin/defaults/config.yaml`, every setting with its default and a comment, as now.
  - The user's file is `$XDG_CONFIG_HOME/coding-agent-kanban-turns/config.yaml`, or `~/.config/coding-agent-kanban-turns/config.yaml` when `XDG_CONFIG_HOME` is unset, merged over the defaults as now.
  - When there's no `config.yaml` and the user's `config.jsonc` exists, it is still read, and the plugin shows a warning naming the file and saying to convert it to `config.yaml`.
- **Data files are YAML.** The protocol spec ([protocol-spec-data](protocol-spec-data.md)), the golden cases ([protocol-golden-cases](../open/protocol-golden-cases.md)) and any other data file in the repository are YAML, read strictly under the YAML 1.2 core schema with duplicate keys refused, by the same library everywhere.
- **A real parser, never a hand-written one.** `plugin/src/config.ts` stops hand-parsing JSONC with regular expressions. Every YAML file is read by a well-known library, such as `yaml`, as `AGENTS.md`'s "well-known libraries over hand-rolled code" asks. The JSONC fallback is read by a well-known JSONC parser, or by the YAML library, which reads JSON, once its comments are taken out by that parser.
- **How the library reaches the engine: bundled by the Nix build.** The plugin has no npm runtime dependency today, and `plugin-authoring`'s reference says the engine loads a module's `claude-code` import and the plugin's own files, so a bare `import "yaml"` isn't expected to resolve. The settings are read at run time, so the library must be there at run time:
  - `flakeModules.claudePlugin`'s build bundles the library into the built plugin as one ES module file of the plugin's own, at a fixed path the core imports by a relative path;
  - the dev shell lays the same file at the same path, so the tests and `plugin-test` load what the built plugin loads;
  - the first step confirms the premise: `claude plugin validate` and a `--plugin-dir` session on a module with a bare `import "yaml"`. If the engine does resolve it from the plugin's `node_modules`, the library is imported directly instead and the bundle step is dropped.
- **Parsing stays pure.** Parsing is a pure function in `plugin/src/config.ts` over the file's text; `plugin/hooks/settings.ts` reads the files and shows the warning.
- **`AGENTS.md`'s Style section says data and settings files are YAML,** and its Layout section and the README name `config.yaml`.

Checks:

- tests in `plugin/test/config.test.ts` for the YAML defaults, a user's YAML file merged over them, a user's `config.jsonc` read with no `config.yaml` beside it, and `config.yaml` winning when both exist;
- a test that an implicitly typed scalar, such as `on` or `1.10`, keeps the type the defaults give that key or is refused;
- no regular expression in `plugin/src/config.ts` parses a settings file;
- an engine test in `plugin/plugin-tests/` loads the built plugin with a user's `config.yaml` and shows its setting in effect, and one with only a `config.jsonc` shows the warning;
- `nix flake check` passes with the bundled library in `packages.plugin`.
