# coding-agent-kanban-turns

The `coding-agent-kanban-turns` Claude Code mod, which makes the Decide items of the `coding-agent-kanban-turn-responses` skill clickable. A click writes the answer's reference, such as `9efb08a1.Decide.2.B`, on a line of its own in the prompt draft and never sends it, so you can pick several answers, add words of your own and press Enter when you're ready.

The mod began in [nhooey/coding-agent-skills](https://github.com/nhooey/coding-agent-skills), beside the skill, and moved here with its history by `git subtree split`.

## Install

At the prompt of a terminal session:

```text
/plugin install coding-agent-kanban-turns --marketplace nhooey/coding-agent-kanban-turns
```

Answer `y` to add the marketplace, then choose a scope. From a shell:

```bash
claude plugin install coding-agent-kanban-turns --marketplace nhooey/coding-agent-kanban-turns
```

With Nix, the flake's `plugin` package (also `default`) is the mod's directory as Claude Code loads it, without the tests or the npm files: `nix build github:nhooey/coding-agent-kanban-turns#plugin`. It's built with [agent-plugins-nixpkgs](https://github.com/nhooey/agent-plugins-nixpkgs)' `lib.mkClaudePlugin`, so that repository can pass it through for a nix-darwin configuration to list in `services.agent-plugins.plugins`.

The mod reads the open items with the kanban skill's `scripts/outstanding.py`, by default the copy Claude Code installs with the skill, `~/.claude/skills/coding-agent-kanban-turn-responses/scripts/outstanding.py`, run with `python3` from your `PATH`. Where the script isn't there, the pane lists only the items the agent's tool calls draw, and `/answers` says why; set `outstanding.script` (see [Settings](#settings)) to use another copy, such as a checkout's.

## Settings

Every setting, with its default and what it does, is in [`mod/defaults/config.jsonc`](mod/defaults/config.jsonc): how `outstanding.py` is run, the pane's hotkey and the colours the items are drawn in. To change one, write only that key in your own file, `$XDG_CONFIG_HOME/coding-agent-kanban-turns/config.jsonc` (`~/.config/coding-agent-kanban-turns/config.jsonc` when `XDG_CONFIG_HOME` is unset):

```jsonc
{ "keys": { "dismiss": "x" } }
```

Sections merge key by key, so everything else follows the defaults as they change. A key that's no setting, or a value of the wrong type, refuses your whole file: the mod uses the defaults and says why in the pane. `/answers-config` lists every setting in effect and the file it came from. Both files are read again whenever the items refresh.

## What it draws

### The pane

The pane, `🧠 Decide`, lists every Decide item raised in the session, oldest first and newest at the bottom, each inside its own rounded border, laid out as the skill writes it. An item stays in the list once raised: when a refresh finds it no longer open, it's dimmed, marked `(settled)`, and its buttons do nothing.

```text
╭──────────────────────────────────────────────────────────────────╮
│ 🔄 Reassess  ❌                                                  │
│                                                                  │
│ ╭──────────────────────────────────────────────────────────────╮ │
│ │ 🧠 Decide.1 · Which cache to keep (settled)                  │ │
│ │    🔘 A. Disk                                                │ │
│ │    🔘 B. Memory                                              │ │
│ ╰──────────────────────────────────────────────────────────────╯ │
│ ╭──────────────────────────────────────────────────────────────╮ │
│ │ 🧠 Decide.2 · Which loader to keep                           │ │
│ │    Both are already built; this only picks the default.      │ │
│ │    🔘 A. Keep the fast loader: it survives restarts.         │ │
│ │       ➕ Faster cold starts.                                 │ │
│ │       ➖ Disk use.                                           │ │
│ │    🔘 B. Keep the small loader: simpler.                     │ │
│ │       ➕ Less code.                                          │ │
│ │       ➖ Slow cold starts.                                   │ │
│ │    ✏️ Notes, or an answer in your own words                  │ │
│ ╰──────────────────────────────────────────────────────────────╯ │
╰──────────────────────────────────────────────────────────────────╯
```

The pane opens by itself, without taking the keyboard, at the session's start when items are open and at the end of a reply that raised a new one, scrolled to its end. Submitting a prompt leaves it open. A pane a mod opens unasked can wait undrawn on a narrow terminal (below 144 columns, 110 once you've opened it yourself), as Claude Code places it. `/answers`, the count line above the prompt and a question in a reply open it with the keyboard.

Each part has its own colour from the theme, so it reads in light and dark themes alike: the title in the accent colour, code spans in another and the option the draft picks on a highlighted background. The ➕ and ➖ lines are plain text, as in a reply, and part of their option: a click on any of an option's lines picks it, and with the pointer on any of them a bar lights in the column left of the option, its full height, in the `colors.hover` colour. The line right under the pointer still inverts, as every button does. Every item is drawn in full, its note and every ➕ and ➖ line, however many rows that takes.

| Control         | What it does                                                                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| an option       | writes `<turn>.Decide.<n>.<letter>` into the draft on a line of its own, ending in a newline, or in place of the item's earlier answer there                                                        |
| `✏️` notes      | on Enter, writes what you typed after the item's reference, on a line of its own: `<turn>.Decide.<n>.B: <note>` with a letter picked, or `<turn>.Decide.<n>: <text>`, an answer in words, with none |
| a checkbox item | toggles its letter in one reference, `…Decide.3.A,C`                                                                                                                                                |
| `🔄 Reassess`   | submits the skill's `reassess` command, which works the open items out afresh; the one button that sends a prompt                                                                                   |
| `❌`            | closes the pane, until a reply raises a Decide item it hasn't shown, or you open it                                                                                                                 |

The hotkey works only where the keyboard is. The prompt holds it by default, so letters typed there stay in the prompt. The pane takes the keyboard when it opens from `/answers`, the count line or a question; else press ctrl+x then tab, or click it. Then `q`, or the key your settings give `keys.dismiss`, presses `❌`, and Escape gives the keyboard back to the prompt. Options have no hotkey, so they read exactly as the skill writes them; click them, or move the focus to one and press Enter. The items refresh when a reply finishes.

### The count line above the prompt

Above the prompt the mod draws the skill's count line, as `outstanding.py render --counts` prints it, such as `📌 Outstanding: 🚧 2 · 🤔 2 · 🔍 2 · 👉 2 · 🧠 3`, then `🪟 ↗`, the arrow in the `colors.expand` colour. Clicking either opens the pane with the keyboard. Where the script prints no line, nothing is drawn there. `/answers` opens the pane too, re-reads the open items and scrolls to the first one the draft doesn't answer; with none open it says there is nothing to answer.

The line draws above whatever else the prompt has above it, such as another mod's agents tree: the line comes first and that drawing beneath. That holds while the kanban mod's hook runs before the other mod's, since a mod that draws its own tree there without passing the rest on hides everything after it.

### Buttons under a reply

The mod registers the tool `kanban_options`, listed as `mcp__coding-agent-kanban-turns__kanban_options`. The agent calls it with the turn's Decide items right before writing its final response, which raises them in the pane. The tool's row comes before the reply, so it draws nothing; the call's input and result show in ctrl+o, or when the call failed or was interrupted, and so does the result line where it's drawn apart from the row, as after a compaction. The items go under the reply instead: the reply's text block that holds their summaries draws its text, then each item it names in its own border, as the pane draws it, with each option's consequence, ➕ and ➖ lines when the call passes them. Their buttons write the draft as the pane's do, and a settled item is dimmed there too.

The mod tells the agent about its tool itself, so the kanban skill needn't: a `prompt.context` hook adds a `kanbanTurns` block to the conversation's context, saying when to call the tool, what its input holds, that a click writes into the draft and sends nothing, and that the reply is written as it would be without the tool. The text, in [`mod/src/instructions.ts`](mod/src/instructions.ts), is built from the tool's registered name.

### Questions in a reply

Each raised item's summary line in a reply, such as `1. **Which cache to keep**`, is drawn as a link. Clicking it opens the pane with the keyboard, scrolled to that item. The link points at `https://kanban-turns.invalid/<ref>`, a name that never resolves, and the stored reply is unchanged, so ctrl+o shows it as written.

## Where the items come from

The mod never parses Markdown. At each refresh it runs `outstanding.py --session <id> render --counts` for the count line and `outstanding.py --session <id> decide --json`, which lists each open Decide item as:

```json
{
  "turn": "9efb08a1",
  "list": "Decide",
  "number": 2,
  "summary": "Backlog cleanups to start",
  "kind": "checkbox",
  "ref": "9efb08a1.Decide.2",
  "options": [{ "letter": "A", "name": "Entry 1411, the matchers made one" }]
}
```

under `{"items": [...]}`. The `kanban_options` tool takes the same object. The skill's `scripts.md` says what counts as open.

## Developing

See [`AGENTS.md`](AGENTS.md) for the dev shell's commands and what `nix flake check` runs. To try the mod from a checkout without installing it:

```bash
claude --plugin-dir mod
```

| File                                                         | Holds                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| [`mod/hooks/register.tsx`](mod/hooks/register.tsx)           | the hooks: the pane, the count line, a reply's links and buttons, the tool, its row and its instructions, `/answers`, `/answers-config`, the refreshes |
| [`mod/hooks/settings.ts`](mod/hooks/settings.ts)             | reads the defaults file and the user's                                                                  |
| [`mod/src/`](mod/src/)                                       | the pure core: the draft's answers, the items raised and settled, the count line, the items' layout and links, the settings, the tool's instructions |
| [`mod/defaults/config.jsonc`](mod/defaults/config.jsonc)     | every setting, with its default and what it does                                                       |
| [`mod/types/index.d.ts`](mod/types/index.d.ts)               | the item, raised items and settings shapes, and the `$.state` contract                                  |
| [`mod/test/`](mod/test/)                                     | the core's tests, run by `node --test`                                                                  |
| [`mod/mod-tests/`](mod/mod-tests/)                           | the pane, the count line, a reply's buttons and the tool row driven through the engine, run by `claude plugin test` |
