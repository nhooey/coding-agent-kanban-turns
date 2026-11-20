# coding-agent-kanban-turns

The `coding-agent-kanban-turns` Claude Code plugin, in TypeScript: a pane that lists the kanban turn responses' Decide items as they're raised, and the same buttons under each reply in the transcript, that answer them. See `README.md`. Plans live in `agents/plans/`; `agents/plans/README.md` is their overview.

## Layout

- `plugin/`: the plugin, the marketplace's source (`.claude-plugin/marketplace.json`).
  - `hooks/`: the effects: `register.tsx` registers every hook, and `settings.ts` reads the settings files.
  - `src/`: the pure core, no `claude-code` import and no I/O, so Node type-checks and tests it.
  - `defaults/config.yaml`: every setting with its default and a comment; a user's own `config.yaml` merges over it.
  - `types/index.d.ts`: the shapes and the `$.state` contract, self-contained as `claude plugin validate` asks.
  - `vendor/`: the runtime libraries the core imports by a relative path, `yaml` and `jsonc-parser`. The engine loads only the plugin's own files, so the flake bundles each into one ES module there (`nix/bundle-vendor.sh`), with its licence beside it. The bundles are committed, for the marketplace install, beside their self-contained types; `nix flake check` holds them to the flake's byte for byte, and `refresh-vendor` lays the flake's after a change to the libraries, the bundling or the flake's inputs (`update-flake`), for a commit.
  - `test/`: the core's tests, `node --test` with Jest's standalone `expect`.
  - `plugin-tests/`: the pane, the count line above the prompt, a reply's buttons and the tool row driven through the engine, `claude plugin test`.
- `skills-devshell/`: the sub-flake that installs this repository's skills into `.agents/skills/`: skillspkgs' `claude-code-tools` combination, plus `coding-agent-kanban-turn-responses`, whose rules the plugin shares, and `design-hygiene-find-implicit-models`.

## Build and test

Enter the dev shell with `nix develop` (or direnv); it links `plugin/node_modules` to the flake's build of the npm dependencies, lays the bundled libraries in `plugin/vendor/`, and installs the project's skills into `.agents/skills/`. Then:

- `tests`: the core's tests (`npm test` in `plugin/`).
- `typecheck`: type-check the core and its tests (`npm run typecheck`).
- `typecheck-plugin`: type-check the hooks against the engine's API, which Claude Code lays in `plugin/.claude-plugin/types/` when it loads the plugin.
- `plugin-test`: `claude plugin validate` and the engine-driven tests; needs the `claude` CLI.
- `plugin-build`: build the plugin as Claude Code loads it (`packages.plugin`: the manifest, `defaults/`, `hooks/`, `src/`, `types/` and `vendor/` with its bundled libraries) and link it to `result-plugin`.
- `refresh-vendor`: lay the flake's bundled libraries in `plugin/vendor/` (`nix/lay-vendor.sh`), as the dev shell does on entry, naming any bundle there the flake no longer makes, to delete by hand; commit what it changes. Run it after `update-flake`, or whenever `check` says the bundles differ.
- `check`: `nix flake check`: formatting (treefmt), `typecheck`, `tests`, the committed bundles against the flake's, and the plugin's build. A build has no engine, so `typecheck-plugin` and `plugin-test` run only in the dev shell; run them before a pull request that touches `plugin/hooks/` or `plugin/plugin-tests/`.

`menu` lists the dev shell's other commands.

To run a change in Claude Code:

- Every session runs the Nix-pinned install, `coding-agent-kanban-turns@nix-pinned`.
- This repository's dev session overrides it with the local build: `claude --plugin-dir result-plugin --continue`.
- After a change, run `plugin-build`, then `/reload-plugins` in that session. A new file reaches the build only once `git add` has staged it.

## Style

The plugin is pure functional TypeScript: small pure functions over readonly data, no mutation or classes, array pipelines over loops, one expression or one return per function where it reads, effects only in `plugin/hooks/`, and well-known libraries over hand-rolled code where the plugin's runtime can load them. Every pure function has a test in `plugin/test/`. Settings go in `plugin/defaults/config.yaml`, never as values in code, as `config-hygiene-shipped-defaults` says. Data and settings files are YAML, read strictly under the YAML 1.2 core schema with duplicate keys refused, by the `yaml` library in `plugin/vendor/`, never by a hand-written parser or a regular expression.

## Rules shared with the kanban skill

The `coding-agent-kanban-turn-responses` skill, in the `coding-agent-skills` repository, and this plugin share rules that each repository keeps on its own, so agents keep them in step: the 9 lists (Done, Pending, Logged, Waiting, Answers, Authorizations, Review, Todo, Decide) and what each holds; the item references, `<turn>.<List>.<n>[.<letters>][: note]`; and what settles an item. A change to any of those rules here comes with a pull request to `coding-agent-skills` making the same change to the skill, and a change there comes with one here.
