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

The mod reads the open items from the session's transcript itself, with no Python and no file from the kanban skill's repository; see [Where the items come from](#where-the-items-come-from).

## Settings

Every setting, with its default and what it does, is in [`mod/defaults/config.jsonc`](mod/defaults/config.jsonc): how many turns the count line reads, how long `gh` may take to say which pull requests merged, the pane's hotkey and the colours the items are drawn in. To change one, write only that key in your own file, `$XDG_CONFIG_HOME/coding-agent-kanban-turns/config.jsonc` (`~/.config/coding-agent-kanban-turns/config.jsonc` when `XDG_CONFIG_HOME` is unset):

```jsonc
{ "keys": { "dismiss": "x" } }
```

Sections merge key by key, so everything else follows the defaults as they change. A key that's no setting, or a value of the wrong type, refuses your whole file: the mod uses the defaults and says why in the pane. An `outstanding` section, which the mod no longer reads, is the exception: it's left out with a warning, and the rest of your file is used. `/answers-config` lists every setting in effect and the file it came from. Both files are read again whenever the items refresh.

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

Above the prompt the mod draws the skill's count line, such as `📌 Outstanding: 🚧 2 · ⏳ 1 · 🔑 1 · 🔍 2 · 👉 2 · 🧠 3`, then `🪟 ↗`, the arrow in the `colors.expand` colour. Clicking either opens the pane with the keyboard. With nothing open, nothing is drawn there. `/answers` opens the pane too, re-reads the open items and scrolls to the first one the draft doesn't answer; with none open it says there is nothing to answer.

The line draws above whatever else the prompt has above it, such as another mod's agents tree: the line comes first and that drawing beneath. That holds while the kanban mod's hook runs before the other mod's, since a mod that draws its own tree there without passing the rest on hides everything after it.

### Buttons under a reply

The mod registers the tool `kanban_options`, listed as `mcp__coding-agent-kanban-turns__kanban_options`. The agent calls it with the turn's Decide items right before writing its final response, which raises them in the pane. The tool's row comes before the reply, so it draws nothing; the call's input and result show in ctrl+o, or when the call failed or was interrupted, and so does the result line where it's drawn apart from the row, as after a compaction. The items go under the reply instead: the reply's text block that holds their summaries draws its text, then each item it names in its own border, as the pane draws it, with each option's consequence, ➕ and ➖ lines when the call passes them. Their buttons write the draft as the pane's do, and a settled item is dimmed there too.

The mod tells the agent about its tool itself, so the kanban skill needn't: a `prompt.context` hook adds a `kanbanTurns` block to the conversation's context, saying when to call the tool, what its input holds, that a click writes into the draft and sends nothing, and that the reply is written as it would be without the tool. The text, in [`mod/src/instructions.ts`](mod/src/instructions.ts), is built from the tool's registered name.

### Questions in a reply

Each raised item's summary line in a reply, such as `1. **Which cache to keep**`, is drawn as a link. Clicking it opens the pane with the keyboard, scrolled to that item. The link points at `https://kanban-turns.invalid/<ref>`, a name that never resolves, and the stored reply is unchanged, so ctrl+o shows it as written.

## Where the items come from

At each refresh the mod reads the session's whole transcript file and works out what's open in TypeScript, as the kanban skill's `reply_turns.py` and `outstanding.py` do, by the same patterns and test cases. The file is Claude Code's JSONL transcript, `~/.claude/projects/<project>/<session>.jsonl`, at the path `$.session.info()` gives, or there when it gives none. It's a private format, not an API: the same file the skill's Python reads, read the same way, so a change to it breaks both alike. The mod reads it with `$.fs.read`, in ranges of 4 MiB, the most one read returns, one after another. When it can't read the file, it settles nothing and reopens nothing, and the pane says why.

- **The turns.** A user record whose `turnOrigin` is `human`, `peer` (an agent's or another session's message) or `task_notification`, or that carries `pluginPrompt` (a prompt a mod submitted, such as the pane's Reassess), opens a turn, unless it's a sidechain's or a compaction's summary. Its id is the first 8 characters of its `promptId`. A message sent while it ran is a `queued_command` attachment: the user's own is an answer, and an agent's, another session's or a task notification a report. A reminder, a skill's body, a local command, and a `!` shell command and its output open none, so a bare answer after `! git log` answers the reply before it. A prompt record the file repeats folds into the first.
- **The Decide items.** A turn's Decide items are its `kanban_options` call's input, each subject's latest only, none from before the latest `reassess` turn.
- **The count line.** It counts the items of the Pending, Waiting, Authorizations, Review, Todo and Decide lists of the last 20 turns' replies (`counts.turns`), never from before the latest `reassess` turn, each item once however often it's restated.
- **What settles an item.** The rules are the skill's own:
  - a Review item, once every pull request it names with its repository, as a GitHub URL or `owner/repo#N`, has merged. The mod asks `gh api graphql --hostname github.com` in one call per refresh, within `counts.gh-timeout-ms`, about the pull requests not yet known merged, and keeps the ones it says merged so it never asks about them again. The pane and the count line are drawn without waiting for `gh`, and the count line again when it says one merged, unless a later refresh has started by then. A bare `#N` is never looked up, and a `gh` that is missing, fails or takes too long settles nothing;
  - a Decide item, once the user answers its latest restatement in a later prompt or in a message sent while a turn ran, by an option's letter or in words: `9efb08a1.Decide.2.B`, `Decide.2: B of 9efb08a1`, `Decide.2: <words>`, or, for the turn before, a line of numbered answers, `2. B` or `1. A / 3. B`. Only the user's own text answers: an agent's message, another session's message, a task notification, a skill's body and a mod's prompt never do. A line holding a question mark answers nothing;
  - a Waiting item, once a report names it in a turn after the last that printed it in its own list: an agent's message, another session's message, or a task notification for a finished task or an expired Monitor, opening a turn or sent while one ran, naming it by the session's name, the agent's id, or the task's id or quoted name in the item's summary, or by a branch-shaped code span of the summary in the report;
  - every item, by a later `reassess` turn: one the user typed, or the pane's Reassess, never an agent's, another session's or a task's message.

  A 📌 roll-up's restatement of a settled item reopens nothing, however long after its own line has left the count line's turns.

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
