# coding-agent-kanban-turns

The `coding-agent-kanban-turns` Claude Code mod, in TypeScript: a band above the prompt and buttons in the transcript that answer the kanban turn responses' Decide items. See `README.md`. Plans live in `agents/plans/`; `agents/plans/README.md` is their overview.

## Layout

- `mod/`: the plugin, the marketplace's source (`.claude-plugin/marketplace.json`).
  - `hooks/`: the effects: `register.tsx` registers every hook, and `settings.ts` reads the settings files.
  - `src/`: the pure core, no `claude-code` import and no I/O, so Node type-checks and tests it.
  - `defaults/config.jsonc`: every setting with its default and a comment; a user's own file merges over it.
  - `types/index.d.ts`: the shapes and the `$.state` contract, self-contained as `claude plugin validate` asks.
  - `test/`: the core's tests, `node --test` with Jest's standalone `expect`.
  - `mod-tests/`: the band and tool row driven through the engine, `claude plugin test`.
- `skills-devshell/`: the sub-flake that installs this repository's skills into `.agents/skills/`.

## Build and test

Enter the dev shell with `nix develop` (or direnv); it links `mod/node_modules` to the flake's build of the npm dependencies and installs the project's skills into `.agents/skills/`. Then:

- `tests`: the core's tests (`npm test` in `mod/`).
- `typecheck`: type-check the core and its tests (`npm run typecheck`).
- `typecheck-plugin`: type-check the hooks against the engine's API, which Claude Code lays in `mod/.claude-plugin/types/` when it loads the mod.
- `plugin-test`: `claude plugin validate` and the engine-driven tests; needs the `claude` CLI.
- `check`: `nix flake check`: formatting (treefmt), `typecheck` and `tests`. A build has no engine, so `typecheck-plugin` and `plugin-test` run only in the dev shell; run them before a pull request that touches `mod/hooks/` or `mod/mod-tests/`.

`menu` lists the dev shell's other commands.

## Style

The mod is pure functional TypeScript: small pure functions over readonly data, no mutation or classes, array pipelines over loops, one expression or one return per function where it reads, effects only in `mod/hooks/`, and well-known libraries over hand-rolled code where the mod's runtime can load them. Every pure function has a test in `mod/test/`. Settings go in `mod/defaults/config.jsonc`, never as values in code, as `config-hygiene-shipped-defaults` says.

## Rules shared with the kanban skill

The `coding-agent-kanban-turn-responses` skill, in the `coding-agent-skills` repository, and this mod share rules that each repository keeps on its own, so agents keep them in step: the 8 lists (Done, Pending, Logged, Waiting, Answers, Review, Todo, Decide) and what each holds; the item references, `<turn>.<List>.<n>[.<letters>][: note]`; and what settles an item. A change to any of those rules here comes with a pull request to `coding-agent-skills` making the same change to the skill, and a change there comes with one here.
