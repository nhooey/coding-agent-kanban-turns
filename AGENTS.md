# coding-agent-kanban-turns

The `coding-agent-kanban-turns` Claude Code plugin, in TypeScript: a pane that lists the kanban turn responses' Decide items as they're raised, and the same buttons under each reply in the transcript, that answer them. See `README.md`. Plans live in `agents/plans/`; `agents/plans/README.md` is their overview.

## Layout

- `plugin/`: the plugin, the marketplace's source (`.claude-plugin/marketplace.json`).
  - `hooks/`: the effects: `register.tsx` registers every hook, and `settings.ts` reads the settings files.
  - `src/`: the pure core, no `claude-code` import and no I/O, so Node type-checks and tests it, in a folder per concern:
    - `protocol/`: `spec.ts`, generated from the spec; `rules.ts`, which derives the patterns and labels several core files share from it; and `instructions.ts`, what the plugin tells the agent about its tool.
    - `transcript/`: the turns and what they hold. What settles items, the count line and the roll-up read harness-neutral turns (`Turn` in `types/index.d.ts`), which the Claude Code adapter, `claude-code.ts`, builds from the session's JSONL records, reports' names and Decide items included; `turns.ts` reads a turn's texts, and `reports.ts` a report's names. `instructed.ts` is the one other module that reads those records, for whether the agent's instructions reached the conversation.
    - `items/`: the Decide items, the draft's answers, the items raised in the session, and what the turns leave open.
    - `pane/`: what the pane and a reply's buttons draw: the text, the turn sections, the layout and the links.
    - `config/`: the settings, read and merged.
  - `spec/`: the protocol's checkable rules, the same for every user: `kanban.yaml` (the lists, the option kinds, the commands, the reference grammar, the roll-up, the 🔖 tag and the rule characters), its JSON Schema `kanban.schema.yaml`, and `kanban.json`, a generated copy for readers that aren't TypeScript. The core reads the rules only from `src/protocol/spec.ts`, never the YAML at run time.
    - `cases/`: the golden cases, one YAML file each, beside their JSON Schema `case.schema.yaml`: a transcript of neutral turns and what the core gives for it, its open items, outstanding items, count line, each turn's command and each reply's lint findings. A case marked `example: false` breaks a rule on purpose, so it is no worked example.
  - `tools/`: the build step that compiles the spec (`spec/load.ts`, pure, and `spec/compile.ts`, which reads and writes the files), and `plugin-test.sh`.
    - `spec/strict.ts`: reads a data file and its schema strictly, for both the spec's build step and the golden cases.
    - `spec/cases.ts`: reads a golden case and works out what the core gives for it.
  - `defaults/config.yaml`: every setting with its default and a comment; a user's own `config.yaml` merges over it.
  - `types/index.d.ts`: the shapes and the `$.state` contract, self-contained as `claude plugin validate` asks.
  - `vendor/`: the runtime libraries the core imports by a relative path, a folder each, `yaml/` alone. The engine loads only the plugin's own files, so the flake bundles each into one ES module in its folder (`nix/scripts/vendor/bundle.sh`), with its `LICENSE` beside it. The bundles are committed, for the marketplace install, beside their self-contained types; `nix flake check` holds them to the flake's byte for byte, and `refresh-vendor` lays the flake's after a change to the libraries, the bundling or the flake's inputs (`update-flake`), for a commit.
  - `test/`: the tests.
    - `unit/`: the core's tests, `node --test` with Jest's standalone `expect`, in folders mirroring `src/`; `protocol/golden-cases.test.ts` runs every golden case, so a new case needs no new test code.
    - `engine/`: the pane, the count line above the prompt, a reply's buttons and the tool row driven through the engine, `claude plugin test`.
    - `fixtures/`: the transcript records and neutral turns the tests build on.
    - `types/`: the declarations Node's type-check needs in place of the engine's, and the check that the vendored parsers' types match their packages'.
    - `oracle/`: the differential test's oracle, which `unit/transcript/neutral-turns.test.ts` compares the adapter and the core against.
- `nix/`: the flake's helpers.
  - `skills-devshell/`: the sub-flake that installs this repository's skills into `.agents/skills/`: skillspkgs' `claude-code-tools` combination, plus `coding-agent-kanban-turn-responses`, whose rules the plugin shares, and `design-hygiene-find-implicit-models`.
  - `scripts/`: the dev shell's startup scripts and the vendor bundles' build, check and lay steps, in `vendor/`.

## Build and test

Enter the dev shell with `nix develop` (or direnv); it links `plugin/node_modules` to the flake's build of the npm dependencies, lays the bundled libraries in `plugin/vendor/`, and installs the project's skills into `.agents/skills/`. Then:

- `tests`: the core's tests (`npm test` in `plugin/`).
- `typecheck`: type-check the core and its tests (`npm run typecheck`).
- `typecheck-plugin`: type-check the hooks against the engine's API, which Claude Code lays in `plugin/.claude-plugin/types/` when it loads the plugin.
- `plugin-test`: `claude plugin validate` and the engine-driven tests; needs the `claude` CLI.
- `plugin-build`: build the plugin as Claude Code loads it (`packages.plugin`: the manifest, `defaults/`, `hooks/`, `src/`, `types/` and `vendor/` with its bundled libraries) and link it to `result-plugin`.
- `refresh-vendor`: lay the flake's bundled libraries in `plugin/vendor/` (`nix/scripts/vendor/lay.sh`), as the dev shell does on entry, naming any bundle there the flake no longer makes, to delete by hand; commit what it changes. Run it after `update-flake`, or whenever `check` says the bundles differ.
- `spec-build`: compile `plugin/spec/kanban.yaml` into `plugin/src/protocol/spec.ts` and `plugin/spec/kanban.json`, refusing a spec that doesn't parse strictly, fit its schema or hold together; commit all three.
- `check`: `nix flake check`: formatting (treefmt), `typecheck`, `tests`, the committed bundles against the flake's, the generated spec files against what the spec compiles to, and the plugin's build. A build has no engine, so `typecheck-plugin` and `plugin-test` run only in the dev shell; run them before a pull request that touches `plugin/hooks/` or `plugin/test/engine/`.

`menu` lists the dev shell's other commands.

To run a change in Claude Code:

- Every session runs the Nix-pinned install, `coding-agent-kanban-turns@nix-pinned`.
- This repository's dev session overrides it with the local build: `claude --plugin-dir result-plugin --continue`.
- After a change, run `plugin-build`, then `/reload-plugins` in that session. A new file reaches the build only once `git add` has staged it.

## Style

The plugin is pure functional TypeScript: small pure functions over readonly data, no mutation or classes, array pipelines over loops, one expression or one return per function where it reads, effects only in `plugin/hooks/`, and well-known libraries over hand-rolled code where the plugin's runtime can load them. Every pure function has a test in `plugin/test/unit/`. Settings go in `plugin/defaults/config.yaml`, never as values in code, as `config-hygiene-shipped-defaults` says, and the protocol's rules, which no user changes, go in `plugin/spec/kanban.yaml`: a list's glyph or header, a command's name or a rule character is read from `src/protocol/spec.ts`, never written into a pattern or a parser in the core. Prose that names a list in words, such as the instructions, the tool's description and the pane's messages, waits for the `protocol-prose-fragments` plan node, which assembles it from the spec. Data and settings files are YAML, read strictly under the YAML 1.2 core schema with duplicate keys refused, by the `yaml` library in `plugin/vendor/`, never by a hand-written parser or a regular expression.

## Rules shared with the kanban skill

The `coding-agent-kanban-turn-responses` skill, in the `coding-agent-skills` repository, and this plugin share rules that each repository keeps on its own, so agents keep them in step: the 9 lists (Done, Pending, Logged, Waiting, Answers, Authorizations, Review, Todo, Decide) and what each holds; the item references, `<turn>.<List>.<n>[.<letters>][: note]`; and what settles an item. A change to any of those rules here comes with a pull request to `coding-agent-skills` making the same change to the skill, and a change there comes with one here.
