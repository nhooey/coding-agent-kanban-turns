## The scripts

This skill's `scripts/` folder holds the {{plugin}} plugin's kanban CLI: the core functions the plugin's hooks and tools call, bundled, so the count line, the roll-up and the lint here are the plugin's own. Run it by its path in this skill's folder, which Claude Code gives as `${CLAUDE_SKILL_DIR}`.

- **`scripts/kanban.js`:** the CLI as one JavaScript file, run with Node 20 or newer: `node "${CLAUDE_SKILL_DIR}/scripts/kanban.js" <command>`. Use it wherever `node` is on the path.
- **`scripts/kanban`:** the same CLI, run by the Node a Nix install of the plugin brings: `"${CLAUDE_SKILL_DIR}/scripts/kanban" <command>`, for where `node` is missing. It finds `kanban.js` beside itself by the path it is run by, so run it by that path, not through a symlink to it elsewhere. Only a Nix install carries it; a copy of the plugin from git has `scripts/kanban.js` alone.

Each command reads the session's turns, from one of:

- **This session's transcript:** with neither option below, in a Claude Code session, which sets `CLAUDE_CODE_SESSION_ID`: the session's file in Claude Code's `projects/` folder, under `CLAUDE_CONFIG_DIR` where it's set and `~/.claude/` otherwise, in the working directory's project folder, else the one project folder that holds it.
- **A transcript:** `--transcript <path>`, a session's file, as Claude Code writes it to `~/.claude/projects/<project>/<session>.jsonl`.
- **Stdin:** `--stdin`, or with no session and no `--transcript`, a JSON list of neutral turns, `[{"id": ..., "prompt": {"owner": "user", "text": ...}, "replies": [...]}]`, the turn ids as references write them, for a harness whose transcript the CLI doesn't read.

In any harness but Claude Code, always pass `--stdin` or `--transcript`: a process started from inside a Claude Code session inherits its `CLAUDE_CODE_SESSION_ID`, so without either the CLI would read that session's transcript, another conversation's.

When to run it:

- **Before a final response that closes on what earlier turns left open:** `due` says whether the full {{roll-up.glyph}} roll-up is due by the roll-up interval, `full`, or else `counts` and the time until it is. Then `rollup` gives the full roll-up's draft, with each item's {{tag.glyph}} tag, to prune of what is settled, or `count` the count line as it prints.
- **Before sending a final response:** `lint --draft -`, with the draft on stdin, and fix every line it reports. With no `--draft`, `lint` checks the last final response in the turns.
- **For a reference's turn id:** `turn-id` gives the current turn's.

The CLI's usage, as `--help` prints it:
