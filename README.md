# coding-agent-kanban-turns

The `coding-agent-kanban-turns` Claude Code plugin, which makes the Decide items of the `coding-agent-kanban-turn-responses` skill clickable. A click writes the answer's reference, such as `9efb08a1.Decide.2.B`, on a line of its own in the prompt draft and never sends it, so you can pick several answers, add words of your own and press Enter, or the pane's `📤 Submit`, when you're ready. A draft a click starts in an empty prompt box opens with a line naming the plugin, so whoever reads it knows where it came from:

```text
coding-agent-kanban-turns:
9efb08a1.Decide.1.A
```

The line is written once and stays first as later clicks and notes write theirs; unpicking every answer takes it out again, leaving the box empty. A draft you began yourself gains no such line. The plugin's transcript reader skips the line, matching it exactly, so it never answers or notes anything. It names the plugin by the name the engine gives it, `$.plugin.name`; the engine doesn't say which marketplace the plugin came from, so the line carries no `@<marketplace>`.

The plugin began in [nhooey/coding-agent-skills](https://github.com/nhooey/coding-agent-skills), beside the skill, and moved here with its history by `git subtree split`.

## Install

At the prompt of a terminal session:

```text
/plugin install coding-agent-kanban-turns --marketplace nhooey/coding-agent-kanban-turns
```

Answer `y` to add the marketplace, then choose a scope. From a shell:

```bash
claude plugin install coding-agent-kanban-turns --marketplace nhooey/coding-agent-kanban-turns
```

With Nix, the flake's `plugin` package (also `default`) is the plugin's directory as Claude Code loads it, without the tests or the npm files: `nix build github:nhooey/coding-agent-kanban-turns#plugin`. It's built with [agent-plugins-nixpkgs](https://github.com/nhooey/agent-plugins-nixpkgs)' `flakeModules.claudePlugin`, so that repository can pass it through for a nix-darwin configuration to list in `services.agent-plugins.plugins`.

The plugin reads the open items from the session's transcript itself, with no Python and no file from the kanban skill's repository; see [Where the items come from](#where-the-items-come-from).

## Settings

Every setting, with its default and what it does, is in [`plugin/defaults/config.jsonc`](plugin/defaults/config.jsonc): how many turns the count line reads, how long `gh` may take to say which pull requests merged, the pane's hotkey and the colours the items are drawn in. To change one, write only that key in your own file, `$XDG_CONFIG_HOME/coding-agent-kanban-turns/config.jsonc` (`~/.config/coding-agent-kanban-turns/config.jsonc` when `XDG_CONFIG_HOME` is unset):

```jsonc
{ "keys": { "dismiss": "x" } }
```

Sections merge key by key, so everything else follows the defaults as they change. A key that's no setting, or a value of the wrong type, refuses your whole file: the plugin uses the defaults and says why in the pane. An `outstanding` section, or a `colors.title` or `colors.expand` setting, which the plugin no longer reads, is the exception: it's left out with a warning naming what to set instead, and the rest of your file is used. `/answers-config` lists every setting in effect and the file it came from. Both files are read again whenever the items refresh.

## What it draws

### The pane

The pane, `🧠 Decide`, lists every Decide item raised in the session, oldest first and newest at the bottom, each inside its own rounded border, laid out as the skill writes it. An item stays in the list once raised: when a refresh finds it no longer open, it's dimmed, marked `(settled)`, a dark blue bar runs down the column left of its options, and its buttons do nothing. A line under its title says what settled it: `Answered in <turn>: <letters>`, the note after ` · ` when the answer gave one, the turn being the one whose prompt or queued message sent the answer; or `Settled: reassessed` for an item a later `reassess` replaced, `Settled: asked again` for one a later item on its subject replaced, and `Settled` where the transcript doesn't say. The options the settling answer picked keep their mark, `☑️` (`marks.sent`), at full strength in the dimmed item and never underlined, so the box still shows what was sent once the draft is gone. The latest answer to an item is the one shown.

```text
╭──────────────────────────────────────────────────────────────────╮
│ 🔄 Reassess  📤 Submit  q: ✖                                     │
│                                                                  │
│ ╭──────────────────────────────────────────────────────────────╮ │
│ │  🧠 Decide.1  Which cache to keep (settled)                  │ │
│ │    Answered in 4a2206b0: A · only for the loader             │ │
│ │  ▌☑️ A. Disk                                                 │ │
│ │  ▌🔘 B. Memory                                               │ │
│ ╰──────────────────────────────────────────────────────────────╯ │
│ ╭──────────────────────────────────────────────────────────────╮ │
│ │  🧠 Decide.2  Which loader to keep                           │ │
│ │    Both are already built; this only picks the default.      │ │
│ │    🔘 A. Keep the fast loader: it survives restarts.         │ │
│ │       ➕ Faster cold starts.                                 │ │
│ │       ➖ Disk use.                                           │ │
│ │    🔘 B. Keep the small loader: simpler.                     │ │
│ │       ➕ Less code.                                          │ │
│ │       ➖ Slow cold starts.                                   │ │
│ │    ✏️ Notes, or an answer in your own words                  │ │
│ │                                                              │ │
│ │                                                              │ │
│ ╰──────────────────────────────────────────────────────────────╯ │
╰──────────────────────────────────────────────────────────────────╯
```

The pane opens by itself, without taking the keyboard, at the session's start when items are open and at the end of a reply that raised a new one, scrolled to its end. Submitting a prompt leaves it open. A pane a mod opens unasked can wait undrawn on a narrow terminal (below 144 columns, 110 once you've opened it yourself), as Claude Code places it. `/answers`, `🖥️ Kanban` and the count line above the prompt, and a question or `✏️ Add a note` in a reply open it with the keyboard. `✏️ Add a note` also moves the focus ring onto that item's notes field, in a pane already open with the ring elsewhere; where the ring can't move yet, as while the pane isn't drawn, the field takes the focus as the pane draws it, until the ring lands there or the pane closes. `/answers` afterwards focuses no field.

Each part has its own colour from the theme, so it reads in light and dark themes alike. An item's title line opens with its label, `🧠 Decide.2`, bold in the `colors.title-label` colour on the `colors.title-background` background, the summary after it in plain text on the same line; a settled item's label is dimmed with the rest, on no background. Code spans are in another colour, and the option the draft picks is underlined, its glyph turned to ✅. A second click on a chosen option unchooses it, taking its answer out of the draft. The ➕ and ➖ lines are plain text, as in a reply, and part of their option: a click on any of an option's lines picks it, and with the pointer on any of them a bar lights in the column left of the option, its full height, in the `colors.hover` colour. The line right under the pointer still inverts, as every button does. A settled item's bar stays lit beside every option, ➕ and ➖ line, in the `colors.settled` colour, and never lights under the pointer. Every item is drawn in full, its note and every ➕ and ➖ line, however many rows that takes.

| Control         | What it does                                                                                                                                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| an option       | writes `<turn>.Decide.<n>.<letter>` into the draft on a line of its own, ending in a newline, or in place of the item's earlier answer there                                                                                                                       |
| `✏️` notes      | on Enter, writes what you typed after the item's reference, on a line of its own: `<turn>.Decide.<n>.B: <note>` with a letter picked, or `<turn>.Decide.<n>: <text>`, an answer in words, with none. The field is `notes.rows` lines tall, 3 by default, so a long note wraps inside it |
| a checkbox item | toggles its letter in one reference, `…Decide.3.A,C`                                                                                                                                                                                                               |
| `🔄 Reassess`   | a toggle: adds `reassess` as the draft's last line, once, below the line naming the plugin and the answers, and sends nothing; a second press takes it out again. It shows `✅` in place of `🔄`, at full strength, while the line is there, and later clicks and notes write their answers above it, so it stays last. Submit then sends any answers and the reassess in one prompt, which settles what it answers, then works the open items out afresh |
| `📤 Submit`     | sends what the prompt box holds, as your own words, and empties the box: the answers you picked, a `reassess` line, and anything you wrote. It's drawn dim, and does nothing, while the box is empty or holds only the line naming the plugin, while a turn runs, and while an earlier Submit is under way, so a double press sends once. Pasted text, images and file mentions need Enter, since only Enter expands them: a draft holding collapsed pasted text's `[Pasted text #n +k lines]`, a pasted image's `[Image #n]`, or an `@` mention that looks like a file (one starting `./`, `../`, `~/`, `/` or a quote, or ending in an extension, such as `@src/x.ts`; not `@alice` or `@types/node`) stays in the box, the pane saying to press Enter in the prompt. When the box can't be emptied first, nothing is sent and the draft stays. When the engine refuses the prompt, the draft goes back in the box, after anything typed there meanwhile, or, where the box can't take it back, into what the pane says, so it isn't lost. Either way the pane says why |
| `✖`             | closes the pane, until a reply raises a Decide item it hasn't shown, or you open it. It's drawn bold, in the `colors.close-x` colour on the `colors.close` background, with a space either side that's part of the button                                       |

Submit is the only button that sends a prompt. It goes as the plugin's prompt on your behalf, which the transcript names as this plugin's, so the plugin reads it as your own text: a submitted answer settles its item at the next refresh, a submitted `reassess` line replaces every earlier item, and it's never read as a report. Another mod's prompt is never your own text. A prompt Submit sends is a turn of its own: Claude Code queues it until the session is idle, rather than joining a running turn as a message typed with Enter does, which is why Submit waits out a running turn.

The hotkey works only where the keyboard is. The prompt holds it by default, so letters typed there stay in the prompt. The pane takes the keyboard when it opens from `/answers`, `🖥️ Kanban`, the count line, a question or `✏️ Add a note`; else press ctrl+x then tab, or click it. Then `q`, or the key your settings give `keys.dismiss`, presses `✖`, and Escape gives the keyboard back to the prompt. Options have no hotkey, so they read exactly as the skill writes them; click them, or move the focus to one and press Enter. The items refresh when a reply finishes.

### The line above the prompt

Above the prompt the plugin draws `🖥️ Kanban`, the word in the `colors.kanban` colour, then a faint ` · ` and the skill's count line, such as `🖥️ Kanban · 📌 Outstanding: 🚧 2 · ⏳ 1 · 🔑 1 · 🔍 2 · 👉 2 · 🧠 3`. Clicking `🖥️ Kanban` or the count line opens the pane with the keyboard. With nothing open, `🖥️ Kanban` is drawn alone, so the pane can always be opened from there; with a survey up, nothing is drawn. `/answers` opens the pane too, re-reads the open items and scrolls to the first one the draft doesn't answer; with none open it says there is nothing to answer.

`🖥️` is U+1F5A5 and the U+FE0F variation selector, which some terminals draw 1 column wide and others 2. Claude Code measures how the terminal draws such a symbol and lays the line out by that, and where it can't tell it treats the glyph's width as uncertain; as the line's first glyph, a wrong guess shifts the rest of the line by a column at most.

The line draws above whatever else the prompt has above it, such as another mod's agents tree: the line comes first and that drawing beneath. That holds while the kanban plugin's hook runs before the other mod's, since a mod that draws its own tree there without passing the rest on hides everything after it.

### Buttons under a reply

The plugin registers the tool `kanban_options`, listed as `mcp__coding-agent-kanban-turns__kanban_options`. The agent calls it with the turn's Decide items right before writing its final response, which raises them in the pane. The tool's row comes before the reply, so it draws nothing; the call's input and result show in ctrl+o, or when the call failed or was interrupted, and so does the result line where it's drawn apart from the row, as after a compaction. The items go under the reply instead: the reply's text block that holds their summaries draws its text, then each item it names in its own border, as the pane draws it, with each option's consequence, ➕ and ➖ lines when the call passes them. Their titles and buttons are drawn as the pane's are and write the draft as the pane's do, and a settled item is dimmed, with its settled bar, the line saying what settled it and its sent options' `☑️`, there too. A reply can't take the keyboard, so an item there has no notes field: `✏️ Add a note` in its place opens the pane with the keyboard, scrolled to that item's notes field, which takes the focus.

The plugin tells the agent about its tool itself, so the kanban skill needn't: a `prompt.context` hook adds a `kanbanTurns` block to the conversation's context, saying when to call the tool, what its input holds, that a click writes into the draft and sends nothing, and that the reply is written as it would be without the tool. The text, in [`plugin/src/instructions.ts`](plugin/src/instructions.ts), is built from the tool's registered name.

### Questions in a reply

Each raised item's summary line in a reply, such as `1. **Which cache to keep**`, is drawn as a link. Clicking it opens the pane with the keyboard, scrolled to that item. The link points at `https://kanban-turns.invalid/<ref>`, a name that never resolves, and the stored reply is unchanged, so ctrl+o shows it as written.

## Where the items come from

At each refresh the plugin reads the session's whole transcript file and works out what's open in TypeScript, as the kanban skill's `reply_turns.py` and `outstanding.py` do, by the same patterns and test cases. The file is Claude Code's JSONL transcript, `~/.claude/projects/<project>/<session>.jsonl`, at the path `$.session.info()` gives, or there when it gives none. It's a private format, not an API: the same file the skill's Python reads, read the same way, so a change to it breaks both alike. The plugin reads it with `$.fs.read`, in ranges of 4 MiB, the most one read returns, one after another. When it can't read the file, it settles nothing and reopens nothing, and the pane says why.

- **The turns.** A user record whose `turnOrigin` is `human`, `peer` (an agent's or another session's message) or `task_notification`, or that carries `pluginPrompt` (a prompt a mod submitted, such as the pane's Submit), opens a turn, unless it's a sidechain's or a compaction's summary. Its id is the first 8 characters of its `promptId`. The user's own text is a prompt they typed, or one whose `pluginPrompt.name` is this plugin's; another mod's prompt is not. A message sent while it ran is a `queued_command` attachment: the user's own is an answer, and an agent's, another session's or a task notification a report. A reminder, a skill's body, a local command, and a `!` shell command and its output open none, so a bare answer after `! git log` answers the reply before it. A prompt record the file repeats folds into the first.
- **The Decide items.** A turn's Decide items are its `kanban_options` call's input, each subject's latest only, none from before the latest `reassess` turn.
- **The count line.** It counts the items of the Pending, Waiting, Authorizations, Review, Todo and Decide lists of the last 20 turns' replies (`counts.turns`), never from before the latest `reassess` turn, each item once however often it's restated.
- **What settles an item.** The rules are the skill's own:
  - a Review item, once every pull request it names with its repository, as a GitHub URL or `owner/repo#N`, has merged. The plugin asks `gh api graphql --hostname github.com` in one call per refresh, within `counts.gh-timeout-ms`, about the pull requests not yet known merged, and keeps the ones it says merged so it never asks about them again. The pane and the count line are drawn without waiting for `gh`, and the count line again when it says one merged, unless a later refresh has started by then. A bare `#N` is never looked up, and a `gh` that is missing, fails or takes too long settles nothing;
  - a Decide item, once the user answers its latest restatement in a later prompt or in a message sent while a turn ran, by an option's letter or in words: `9efb08a1.Decide.2.B`, `Decide.2: B of 9efb08a1`, `Decide.2: <words>`, or, for the turn before, a line of numbered answers, `2. B` or `1. A / 3. B`. Only the user's own text answers, the pane's Submit sending the draft among it: an agent's message, another session's message, a task notification, a skill's body and another mod's prompt never do. A line holding a question mark answers nothing;
  - a Waiting item, once a report names it in a turn after the last that printed it in its own list. The user's own text, the pane's Submit among it, is never a report. A report is an agent's message, another session's message, or a task notification for a finished task or an expired Monitor, opening a turn or sent while one ran, naming it by the session's name, the agent's id, or the task's id or quoted name in the item's summary, or by a branch-shaped code span of the summary in the report;
  - every item, by a later `reassess` turn: the user's own prompt, typed or sent by the pane's Submit, never an agent's, another session's, a task's or another mod's message. The line naming the plugin that opens a draft from the pane, `coding-agent-kanban-turns:` or `coding-agent-kanban-turns@<marketplace>:` alone on the first line, is left out first. A command runs from the prompt's opening word, bare or after the skill's slash command: `reassess`, a synonym (`recheck`, `regenerate`, `recalculate`), or a prefix of them no other command's name shares. Failing that, the prompt reassesses when its last line that isn't blank is such a word alone, trailing `.,;:!` allowed, as the pane's Reassess button leaves the draft, with or without answers before it: any answers count, settling what they answer, and the reassess starts at that turn. Only `reassess` runs from the last line; `open` doesn't. The skill's `outstanding.py` reads a reassess by the same rule.

  The parse that settles a Decide item also keeps the answer's letters, its note and the turn it was sent in, for the line under a settled item's title.

  A 📌 roll-up's restatement of a settled item reopens nothing, however long after its own line has left the count line's turns.

## Developing

See [`AGENTS.md`](AGENTS.md) for the dev shell's commands and what `nix flake check` runs. To try the plugin from a checkout without installing it, build it with the dev shell's `plugin-build` and load the build:

```bash
claude --plugin-dir result-plugin
```

| File                                                               | Holds                                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| [`plugin/hooks/register.tsx`](plugin/hooks/register.tsx)           | the hooks: the pane, the count line, a reply's links and buttons, the tool, its row and its instructions, `/answers`, `/answers-config`, the refreshes |
| [`plugin/hooks/settings.ts`](plugin/hooks/settings.ts)             | reads the defaults file and the user's                                                                  |
| [`plugin/src/`](plugin/src/)                                       | the pure core: the draft's answers, the items raised and settled, the count line, the items' layout and links, the settings, the tool's instructions |
| [`plugin/defaults/config.jsonc`](plugin/defaults/config.jsonc)     | every setting, with its default and what it does                                                       |
| [`plugin/types/index.d.ts`](plugin/types/index.d.ts)               | the item, raised items and settings shapes, and the `$.state` contract                                  |
| [`plugin/test/`](plugin/test/)                                     | the core's tests, run by `node --test`                                                                  |
| [`plugin/plugin-tests/`](plugin/plugin-tests/)                     | the pane, the count line, a reply's buttons and the tool row driven through the engine, run by `claude plugin test` |
