---
title: A CLI over the pure core, built by Nix as kanban.js and standalone binaries, is how the derived skill runs the protocol
state: implemented
kind: implementation
part-of: plugin-sole-source
needs: [neutral-turn-stream, plugin-tools-replace-skill-scripts]
touches: [plugin/cli/, flake.nix, plugin/package.json]
implemented-by: kanban-cli-adapter
---

# A CLI over the pure core, built by Nix as kanban.js and standalone binaries, is how the derived skill runs the protocol

- **Subcommands**, each a thin edge over a pure function of the core:
  - `count`: the 📌 count line;
  - `rollup`: the 📌 roll-up in full;
  - `lint`: a reply's findings, a draft's or the last final response, the one the turn's end lints, exiting non-zero when there are any;
  - `turn-id`: the current turn's id.
- **The core reads a neutral turn list** ([neutral-turn-stream](../closed/neutral-turn-stream.md)), and the CLI gets one from:
  - a transcript file by path, through a small transcript adapter per harness, Claude Code's JSONL first, chosen by a flag;
  - stdin, as a JSON list of neutral turns, the fallback for a harness with no adapter here.
- **Built by Nix.** Flake packages build:
  - `kanban.js`: the CLI and the core bundled into one JS file that runs under Node 20 or later, with no `node_modules`;
  - standalone binaries, one per platform the flake builds for, that need no Node installed but do need their Nix closure, the libraries Node links to.
- **The derived skill runs it.** The skill's scripts are this CLI ([derived-skill-package](../open/derived-skill-package.md)): `kanban.js` where Node is on the path, a standalone binary where it isn't.

Checks:

- a test runs each subcommand on the golden cases ([protocol-golden-cases](../closed/protocol-golden-cases.md)), through stdin and through the Claude Code adapter, and compares its output with the case's expectation;
- `nix flake check` builds `kanban.js` and the binary for its own platform, and runs each once on a case.
