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

Every setting, with its default and what it does, is in [`plugin/defaults/config.yaml`](plugin/defaults/config.yaml): how many turns the count line reads, how long `gh` may take to say which pull requests merged, the pane's keys, whether Submit closes the pane once nothing is left open, and the colours the items are drawn in. To change one, write only that key in your own file, `$XDG_CONFIG_HOME/coding-agent-kanban-turns/config.yaml` (`~/.config/coding-agent-kanban-turns/config.yaml` when `XDG_CONFIG_HOME` is unset):

```yaml
keys:
  dismiss: x
```

Both files are YAML 1.2, read strictly under its core schema: `on` and `yes` are strings, and a key written twice refuses the file. Sections merge key by key, so everything else follows the defaults as they change. A key that's no setting, a value of the wrong type, a key under `keys` that isn't one lowercase letter or digit, or two settings under `keys` bound to the same key refuses your whole file: the plugin uses the defaults and says why in the pane. An `outstanding` section, or a `pane.hints`, `colors.title`, `colors.expand` or `colors.close-x` setting, which the plugin no longer reads, is the exception: it's left out with a warning naming what to set instead, and the rest of your file is used. Your own file is `config.yaml`; no other name is read. `/answers-config` lists every setting in effect and the file it came from. Both files are read again whenever the items refresh.

## What it draws

### The pane

The pane, `🧠 Decide`, lists every Decide item raised in the session, top to bottom:

- **The header row:** `🖥️ Kanban · 📌 <count line>`, the same text and colours as the line above the prompt, then `n of m answered`, the open items the draft answers out of every open item, then `↑ Previous`, `↓ Next`, `? Keys` and `✖ Close`. Claude Code has no sticky rows, so it's simply the pane's first row, and scrolls away with the rest.
- **The keys panel,** once `? Keys` opens it: a row per key the pane takes and what it does, read from the `keys` settings, so a key you rebound shows as you bound it. A second press of `? Keys`, or its key, closes it; a closed panel draws nothing. Escape can't close it: Claude Code keeps Escape for giving the keyboard back to the prompt, and never passes it to the pane.
- **The items, newest turn first.** Each turn opens on a faint header naming its id and its index counting back from the latest turn, `── 9efb08a1 ₋₂ ──`, in Unicode subscript as the kanban skill's 🔖 tag writes it, the latest turn `₀`. A turn the transcript doesn't hold yet, such as the one whose reply is still being drawn, has no index and comes first. Its open items follow, each drawn in full in its own rounded border, as the skill writes it, then its Done section.
- **The footer row:** what Submit will send, `Draft: 2 answers · 1 note · reassess`, naming words of your own as `your words`, or `Draft: empty`; then `🔄 Reassess` and `📤 Submit`.

With nothing open, `Nothing open` stands under the header row. The space under the header row is kept for the filters to come.

```text
╭──────────────────────────────────────────────────────────────────╮
│ 🖥️ Kanban · 📌 Outstanding: 🚧 1 · 🧠 2   1 of 2 answered        │
│             k: ↑ Previous  j: ↓ Next  h: ? Keys  q: ✖ Close      │
│                                                                  │
│ ── b2c3d4e5 ₀ ──                                                 │
│ ╭──────────────────────────────────────────────────────────────╮ │
│ │  🧠 Decide.1  Which loader to keep                           │ │
│ │    Both are already built; this only picks the default.      │ │
│ │    ✅ A. Keep the fast loader: it survives restarts.         │ │
│ │       ➕ Faster cold starts.                                 │ │
│ │       ➖ Disk use.                                           │ │
│ │    🔘 B. Keep the small loader: simpler.                     │ │
│ │       ➕ Less code.                                          │ │
│ │       ➖ Slow cold starts.                                   │ │
│ │    ✏️ Notes, or an answer in your own words                  │ │
│ ╰──────────────────────────────────────────────────────────────╯ │
│                                                                  │
│ ── 9efb08a1 ₋₂ ──                                                │
│ ╭──────────────────────────────────────────────────────────────╮ │
│ │  🧠 Decide.2  Which port to serve on                         │ │
│ │    🔘 A. 8080                                                │ │
│ │    🔘 B. 8443                                                │ │
│ │    ✏️ Notes, or an answer in your own words                  │ │
│ ╰──────────────────────────────────────────────────────────────╯ │
│ ▾ Done (1)                                                       │
│ ▌🧠 Decide.1  Which cache to keep · Answered in 4a2206b0: A      │
│                                                                  │
│ Draft: 1 answer                      r: 🔄 Reassess  s: 📤 Submit │
╰──────────────────────────────────────────────────────────────────╯
```

An item stays in the pane once raised. When a refresh finds it no longer open, it's Done, and moves to its turn's Done section: one header, `▸ Done (2)`, collapsed at first, which draws nothing else. A click on it opens the section, `▾ Done (2)`, to one dim line per Done item, `▌🧠 Decide.1  <summary> · <what made it Done>`, the `▌` in the `colors.settled` colour; a second click collapses it. A click on a Done item's line opens its full box, and a click on that box's title closes it to its line again. The box is dimmed, marked `(done)`, and the `colors.settled` bar runs down the column left of its options, but its options pick as an open item's do: a click writes a fresh reference into the draft, the option's glyph turned to ✅, while the option the earlier answer picked keeps its `☑️`, so both show. The item stays in its Done section until a refresh finds the new answer, which then says what made it Done. A Done item has no notes field.

What made an item Done is said on its line and under its box's title: `Answered in <turn>: <letters>`, the note after ` · ` when the answer gave one, the turn being the one whose prompt or queued message sent the answer; `Sent: <letters>` for an answer `📤 Submit` sent that the turn's end hasn't read yet; `Done: reassessed` for an item a later `reassess` replaced, `Done: asked again` for one a later item on its subject replaced, and `Done` where the transcript doesn't say. The options the answer picked keep their mark, `☑️` (`marks.sent`), at full strength in the dimmed box and never underlined, so the box still shows what was sent once the draft is gone. The latest answer to an item is the one shown.

The pane opens by itself, without taking the keyboard, at the session's start when items are open and at the end of a reply that raised a new one, scrolled to its top, where the newest turn is. Submitting a prompt leaves it open, but for one case: when the pane's `📤 Submit` sends a prompt that, counting the answers it sends, leaves no item open, the pane closes, as `pane.close-when-all-submitted`, on by default, says; set it to `false` to keep the pane open. A Submit the engine refuses, or that sends nothing, leaves it open. When the turn's end puts an item back among the open ones, the pane doesn't reopen by itself, but the count line above the prompt counts the item. A pane a mod opens unasked can wait undrawn on a narrow terminal (below 144 columns, 110 once you've opened it yourself), as Claude Code places it. `/answers`, `🖥️ Kanban`, the count line and `✏️ n picked` above the prompt, and a question or `✏️ Add a note` in a reply open it with the keyboard; a question whose item is Done opens its Done section and its box. `✏️ Add a note` also moves the focus ring onto that item's notes field, in a pane already open with the ring elsewhere; where the ring can't move yet, as while the pane isn't drawn, the field takes the focus as the pane draws it, until the ring lands there or the pane closes. `/answers` afterwards focuses no field.

Each part has its own colour from the theme, so it reads in light and dark themes alike. An item's title line opens with its label, `🧠 Decide.2`, bold in the `colors.title-label` colour on the `colors.title-background` background, the summary after it in plain text on the same line; a Done item's label is dimmed with the rest, on no background. Code spans are in another colour, and the option the draft picks is underlined, its glyph turned to ✅. A second click on a chosen option unchooses it, taking its answer out of the draft. The ➕ and ➖ lines are plain text, as in a reply, and part of their option: a click on any of an option's lines picks it, and with the pointer on any of them a bar lights in the column left of the option, its full height, in the `colors.hover` colour. Each line is one button and one focus stop: its text is the button, and its lead, `🔘 A. ` or `➕ `, is plain text beside it, since a Claude Code button holds only text, never the Box that keeps the lead apart; a click on the lead itself picks nothing. The text under the pointer inverts, as every button does. A Done item's bar stays lit beside every option, ➕ and ➖ line, in the `colors.settled` colour, and never lights under the pointer. Every open item is drawn in full, its note and every ➕ and ➖ line, however many rows that takes. A line that wraps continues under its own text, not under its lead: an option's rows under the text after `🔘 A. `, a ➕ or ➖ line's under the text after its glyph, a title's under its summary, and a Done line's under the summary after its label. The lead sits in a Box as many cells wide as it takes, an emoji counting 2, and the engine wraps the text in the room beside it.

| Control                  | What it does                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| an option                | writes `<turn>.Decide.<n>.<letter>` into the draft on a line of its own, ending in a newline, or in place of the item's earlier answer there                                                                                                                                                                                                                                          |
| `✏️` notes               | on Enter, writes what you typed after the item's reference, on a line of its own: `<turn>.Decide.<n>.B: <note>` with a letter picked, or `<turn>.Decide.<n>: <text>`, an answer in words, with none. The field is `notes.rows` lines tall, 3 by default, so a long note wraps inside it                                                                                                |
| a checkbox item          | toggles its letter in one reference, `…Decide.3.A,C`                                                                                                                                                                                                                                                                                                                                  |
| `▸ Done (n)`             | opens its turn's Done section, a line per Done item, and closes it again                                                                                                                                                                                                                                                                                                             |
| a Done item's line       | its summary opens its full box, whose summary closes it again; its options pick as an open item's do, and a Submit that sends a new answer to it says `Sent: <letters>` on its line                                                                                                                                                                                                  |
| `? Keys`                 | opens the keys panel under the header row, and closes it again                                                                                                                                                                                                                                                                                                                       |
| `↑ Previous`, `↓ Next`   | move the focus ring to the item before or after the one it's on, an open item's first option or a Done header or line, the pane scrolled to show it; from no item, `↓` goes to the first and `↑` to the last. Each is dim at its end of the items                                                                                                                                    |
| `🔄 Reassess`            | a toggle: adds `reassess` as the draft's last line, once, below the line naming the plugin and the answers, and sends nothing; a second press takes it out again. Its glyph is `✅` while the line is there, and later clicks and notes write their answers above it, so it stays last. Submit then sends any answers and the reassess in one prompt, which makes what it answers Done, then works the open items out afresh |
| `📤 Submit`              | sends what the prompt box holds, as your own words, and empties the box: the answers you picked, a `reassess` line, and anything you wrote. The items it answers move to their Done sections at once, saying `Sent: <letters>`; the transcript read at the turn's end keeps each there as answered, or puts it back among the open items. A Submit whose answers leave no item open closes the pane, as `pane.close-when-all-submitted` says. It's drawn dim, and does nothing, while the box is empty or holds only the line naming the plugin, while a turn runs, and while an earlier Submit is under way, so a double press sends once. Pasted text, images and file mentions need Enter, since only Enter expands them: a draft holding collapsed pasted text's `[Pasted text #n +k lines]`, a pasted image's `[Image #n]`, or an `@` mention that looks like a file (one starting `./`, `../`, `~/`, `/` or a quote, or ending in an extension, such as `@src/x.ts`; not `@alice` or `@types/node`) stays in the box, the pane saying to press Enter in the prompt. When the box can't be emptied first, nothing is sent and the draft stays. When the engine refuses the prompt, the draft goes back in the box, after anything typed there meanwhile, or, where the box can't take it back, into what the pane says, so it isn't lost. Either way nothing moves to Done, and the pane says why |
| `✖ Close`                | closes the pane, until a reply raises a Decide item it hasn't shown, or you open it. The `✖` is in the `colors.close` colour                                                                                                                                                                                                                                                         |

Submit is the only button that sends a prompt. It goes as the plugin's prompt on your behalf, which the transcript names as this plugin's, so the plugin reads it as your own text: a submitted answer makes its item Done, a submitted `reassess` line replaces every earlier item, and it's never read as a report. Another mod's prompt is never your own text. A prompt Submit sends is a turn of its own: Claude Code queues it until the session is idle, rather than joining a running turn as a message typed with Enter does, which is why Submit waits out a running turn.

### Keys

The keys work only where the keyboard is. The prompt holds it by default, so letters typed there stay in the prompt. The pane takes the keyboard when it opens from `/answers`, `🖥️ Kanban`, the count line, `✏️ n picked`, a question or `✏️ Add a note`; else press ctrl+x then tab, or click it. Then each key presses its button, which draws it before its glyph, as `s: 📤 Submit`; each is a setting under `keys`:

| Key | Setting         | Presses       |
| --- | --------------- | ------------- |
| `j` | `keys.next`     | `↓ Next`      |
| `k` | `keys.previous` | `↑ Previous`  |
| `s` | `keys.submit`   | `📤 Submit`   |
| `r` | `keys.reassess` | `🔄 Reassess` |
| `h` | `keys.help`     | `? Keys`      |
| `q` | `keys.dismiss`  | `✖ Close`     |

Each key is one lowercase letter or digit, the only keys Claude Code lets a button take, so `? Keys` can't be bound to `?` itself; no two settings may share one. The arrow keys and Tab move the focus ring as Claude Code moves it, from one button or field to the next, so through each option of an item; `j` and `k` move by whole items. Enter presses the button the ring is on, and Escape gives the keyboard back to the prompt. Options have no key of their own, so they read exactly as the skill writes them. The items refresh when a reply finishes.

### The line above the prompt

Above the prompt the plugin draws `🖥️ Kanban`, the word in the `colors.kanban` colour, then a faint ` · ` and the skill's count line, such as `🖥️ Kanban · 📌 Outstanding: 🚧 2 · ⏳ 1 · 🔑 1 · 🔍 2 · 👉 2 · 🧠 3`, and, while the draft answers open items, another ` · ` and how many, `✏️ 2 picked`. A click on any of them opens the pane with the keyboard. With nothing open, `🖥️ Kanban` is drawn alone, so the pane can always be opened from there; with a survey up, nothing is drawn. `/answers` opens the pane too, re-reads the open items and scrolls to the first one the draft doesn't answer, in the pane's order, newest turn first; with none open it says there is nothing to answer.

`🖥️` is U+1F5A5 and the U+FE0F variation selector, which some terminals draw 1 column wide and others 2. Claude Code measures how the terminal draws such a symbol and lays the line out by that, and where it can't tell it treats the glyph's width as uncertain; as the line's first glyph, a wrong guess shifts the rest of the line by a column at most.

The line draws above whatever else the prompt has above it, such as another mod's agents tree: the line comes first and that drawing beneath. That holds while the kanban plugin's hook runs before the other mod's, since a mod that draws its own tree there without passing the rest on hides everything after it.

### Buttons under a reply

The plugin registers the tool `kanban_options`, listed as `mcp__coding-agent-kanban-turns__kanban_options`. The agent calls it with the turn's Decide items right before writing its final response, which raises them in the pane. The tool's row comes before the reply, so it draws nothing; the call's input and result show in ctrl+o, or when the call failed or was interrupted, and so does the result line where it's drawn apart from the row, as after a compaction.

The items go into the reply instead, in place of its Decide list: the reply's text block that holds their summaries draws its text up to the list's header, then each item it names in its own border, as the pane draws it, with each option's consequence, ➕ and ➖ lines when the call passes them, then the text after the list. The list is cut out only when it's found intact: exactly one Decide list, before any 📌 roll-up, ending at a blank line, the next header, a topic header or prose at a line's start, whose numbered summaries name the items, every one and no other, in their order, each item's block holding its options' letters and names. A list in an earlier reply whose item a later reply restated with other options is drawn whole. Otherwise the reply's text is drawn whole, with its questions as links, and the boxes under it. The stored reply is unchanged either way, so ctrl+o shows it as written.

The boxes' titles and buttons are drawn as the pane's are and write the draft as the pane's do, and a Done item is dimmed, with its settled bar, the line saying what made it Done and its sent options' `☑️`, there too, drawn in full, its options picking as in the pane. A reply can't take the keyboard, so an item there has no notes field: `✏️ Add a note` in its place opens the pane with the keyboard, scrolled to that item's notes field, which takes the focus.

The plugin teaches the agent the whole turn-response format itself, once per conversation, so a session with the plugin and no kanban skill learns it: the progress updates, the lists and their shape, the Decide items, the user's answers, the 📌 roll-up and the commands; and its tool: when to call it, what its input holds, that a click writes into the draft and sends nothing, and that the reply is written as it would be without the tool. A `prompt.context` hook adds them to the conversation's context as a `kanbanTurns` block. On a machine with managed settings, Claude Code's built-in cc-plugin-sec-default sends `prompt.context` on past every plugin a person installs, and a `prompt.submit` hook adds them to the first prompt's context instead. Whichever runs first adds them and the other adds none, and after a compaction or `/clear` the next one adds them again, as the transcript shows ([`plugin/src/transcript/instructed.ts`](plugin/src/transcript/instructed.ts)). A load of the plugin's own skill counts as the instructions arriving, so neither hook adds them while one is in the conversation: the agent's `Skill` call for it whose result isn't an error, the user's slash command for it, or the `invoked_skills` attachment naming it that Claude Code writes after a compaction. The text is the prose fragments in [`plugin/spec/fragments/`](plugin/spec/fragments/), a Markdown file per topic whose placeholders the protocol's spec fills, assembled in [`plugin/src/protocol/instructions.ts`](plugin/src/protocol/instructions.ts) with the tool's registered name. The block opens on a line naming the plugin's skill, `coding-agent-kanban-turns:coding-agent-kanban-turn-responses`, and saying the block is that skill's format, without its worked examples or its preferences files, so the skill needn't be loaded; it also says that a copy of the `coding-agent-kanban-turn-responses` skill installed apart from the plugin governs where the two differ. It teaches a yes-or-no question as a 🔘 radio item lettered A and B; the plugin still reads the 👍 Y and 👎 N options older replies hold.

### The open items and the reply lint

Two more tools do what the kanban skill's `outstanding.py` and `lint_reply.py` scripts did, and the instructions tell the agent when to call each:

- **`kanban_outstanding`** takes nothing. It gives the count line, a draft of the full 📌 roll-up with each item's 🔖 tag, and the open Decide items raised through `kanban_options`, in its input's shape, over the turns the count line reads (`counts.turns`). It asks `gh` about the Review items' pull requests first, as a refresh does, and says so where `gh` doesn't answer. The draft cuts each summary to `roll-up.summary-width`, 100 by default, keeping a link whole, and leaves out what the plugin can tell is settled; the agent prunes the rest ([`plugin/src/items/roll-up.ts`](plugin/src/items/roll-up.ts)).
- **`kanban_lint`** takes a draft final response, `{"text": "..."}`, and gives each line that breaks a layout rule, by its line and rule, with what it found there where that helps: separator lines, a numbered item's summary line, a list among a Decide item's options, an option of a kind no longer taught (👍 Y. or 👎 N.), a header's underline, a list's end, where a table goes, and a list's numbers under topic headers ([`plugin/src/lint/reply.ts`](plugin/src/lint/reply.ts)).
- **At the turn's end** the plugin lints the final response itself, where it has a list's header, the 📌 roll-up or its count line, while `lint.turn-end` is on, as it is by default. What it finds is shown beneath the response, and goes in the next prompt's context in the same conversation, so the agent reads it; a `/clear`, a compaction or a resume drops it. A clean response clears it.

### The kanban CLI

The `kanban` CLI runs the same core functions outside Claude Code's engine, for a skill or a harness with no plugin hooks ([`plugin/cli/`](plugin/cli/)):

| Command   | Gives                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------ |
| `count`   | the 📌 count line                                                                                      |
| `rollup`  | the full 📌 roll-up, each item ending in its 🔖 tag                                                    |
| `due`     | `full` where the full 📌 roll-up is due by the roll-up interval, else `counts` and the time until it is |
| `lint`    | the reply lint's findings for a `--draft` or the last final response; `--json` as JSON                 |
| `turn-id` | the current turn's id                                                                                  |

- **The turns** come from `--transcript <path>`, read through the adapter `--harness` names (`claude-code`, the only one so far); else, in a Claude Code session, from the transcript `CLAUDE_CODE_SESSION_ID` names, in the working directory's project folder under `projects/` in `CLAUDE_CONFIG_DIR`, or `~/.claude/` where it's unset, or the one that holds it; else, or with `--stdin`, from stdin, as a JSON list of neutral turns (`Turn` in [`plugin/types/index.d.ts`](plugin/types/index.d.ts)). A process started from a Claude Code session inherits its `CLAUDE_CODE_SESSION_ID`, so any other harness passes `--stdin` or `--transcript` always.
  - A turn needs its `id`, 8 characters of `0-9a-f`, unique, and its `prompt`, `{"owner", "text"}`. Its `replies`, `decide` and `messages` may be left out, as may its `unanswered`, its `promptedAt` and `answeredAt`, ISO 8601 times that `due` reads and takes as unknown where left out, a message's `reportNames`, and a Decide item's `turn` and `kind`. A Decide item's `ref` and `list` are dropped and worked out afresh.
  - Any other field, a field of the wrong type, an unknown option kind or an option letter outside A to Z, or outside the kind's own, is refused, by its place.
- **`lint` reads the final response the turn's end lints.** It passes over an unanswered turn, `unanswered: true`, so text written on the way is no final response. The Claude Code adapter sets it on a turn whose last response didn't end it with an answer: one still running, interrupted, cut off by an API error or refused. It also passes over a response with no list's header, roll-up or count line.
- **The settings** are the plugin's: `counts.turns` and `roll-up.summary-width`, from the defaults with the user's `config.yaml` merged over them, which `--window` and `--width` override. The CLI asks GitHub nothing: `--merged owner/repo#N`, or the pull request's URL, names each pull request known merged.
- **Exit codes:** 0 when done, 1 when `lint` finds something, and 2 when the arguments, the input or the settings can't be used, as stderr says.
- **Built by the flake,** each with the YAML parser's licence in `share/licenses/yaml/`:
  - `nix build .#kanban-js` gives `bin/kanban.js`, one file that runs under Node 20 or later and names no store path. The plugin's package carries it in its skill's `scripts/`, beside `kanban`, a wrapper that runs it with the Nix store's `node`;
  - `nix build .#kanban` gives `bin/kanban`, a Node single executable application for the system building it. It needs no Node installed, but it runs only where its Nix closure is, the libraries Node links to. The plugin doesn't carry it.

### The skill it carries

The plugin carries a skill derived from it, `coding-agent-kanban-turns:coding-agent-kanban-turn-responses`, the fallback that teaches the format and runs the protocol where the plugin's hooks don't load. Its slash command runs a command after it, as the skill's own does: `/coding-agent-kanban-turns:coding-agent-kanban-turn-responses reassess`. Its description defers to the hooks' block: it tells the agent to load the skill only where the conversation holds no block opening on the line that names the skill. Nothing in it is written by hand:

- **`SKILL.md`** is the instructions' fragments, filled in from the spec as the instructions are, with the CLI in place of the plugin's tools, and its usage as `--help` prints it ([`plugin/tools/skill/render.ts`](plugin/tools/skill/render.ts)).
- **`examples/`** holds a worked example for each golden case not marked `example: false`: its turns, each prompt and response as written, and what the core gives for them that a reply alone settles. A worked example draws only the option kinds the instructions teach, 🔘 and 🔲, and the build refuses one that draws 👍 or 👎, which the lint's `untaught-option` rule finds.
- **`scripts/`** holds the CLI, `kanban.js` and, in a Nix build alone, `kanban`, a wrapper that runs it with the Nix store's `node`, so the skill counts, rolls up, times the roll-up (`due`) and lints with the same core functions as the hooks. In a Claude Code session it reads the session's own transcript unless told otherwise.

Where each install gets it:

| Install | The skill's folder | Its scripts |
| --- | --- | --- |
| Nix, `packages.plugin` | built by the flake and copied into `skills/` | `kanban.js`, which needs Node 20 or newer, and the `kanban` wrapper, which brings its own |
| git, the marketplace's `./plugin` | the copy committed in [`plugin/skills/`](plugin/skills/), which `nix flake check` holds to the flake's build file for file and mode for mode | `kanban.js` alone, which needs Node 20 or newer |
| a harness without plugins, `packages.skill-standalone` | the same build as the plugin's, a plain skill folder | as the Nix install's |

A change to the fragments, the spec, the golden cases, the CLI or the core it bundles changes the skill, and `refresh-skill` in the dev shell lays the flake's build in `plugin/skills/` for the commit.

### Questions in a reply

Where a reply's Decide list isn't cut out, each raised item's summary line in it, such as `1. **Which cache to keep**`, is drawn as a link. Clicking it opens the pane with the keyboard, scrolled to that item. The link points at `https://kanban-turns.invalid/<ref>`, a name that never resolves.

### Style

The pane, the line above the prompt and the boxes under a reply share one style:

- **Buttons:** every button is `glyph label`, such as `📤 Submit` or `▸ Done (2)`, drawn plain, with no chrome or padding of its own, its key before it where it has one, and inverted under the pointer. A button that can't act now is dim, and pressing it does nothing.
- **Dim** means "not actionable now" or "Done": a button that can't act, the pane's faint text, a turn's header and `Nothing open`, and a Done item's title, its one-line row and the line saying what made it Done. A Done item's row and title stay clickable, to open and close its box; its options, which still pick, are at full strength.
- **Wrapping:** a line that wraps continues under its text, never under its lead, a glyph, a letter or a label.
- **Labels:** a list's label is the skill's glyph and name, `🧠 Decide.1`, as the skill writes it.
- **Colours:** every colour is a theme colour named by a setting under `colors`; no other colour is drawn.
- **Spacing:** one blank row between turns, and none between a turn's items.

## Where the items come from

At each refresh the plugin reads the session's whole transcript file and works out what's open in TypeScript, as the kanban skill's `reply_turns.py` and `outstanding.py` do, by the same patterns and test cases. The file is Claude Code's JSONL transcript, `~/.claude/projects/<project>/<session>.jsonl`, at the path `$.session.info()` gives, or there when it gives none. It's a private format, not an API: the same file the skill's Python reads, read the same way, so a change to it breaks both alike. The plugin reads it with `$.fs.read`, in ranges of 4 MiB, the most one read returns, one after another. When it can't read the file, it makes nothing Done and reopens nothing, and the pane says why; answers Submit sent stay Done until a turn's end reads the file.

- **The turns.** A user record whose `turnOrigin` is `human`, `peer` (an agent's or another session's message), `task_notification` or `scheduled` (the stored prompt a `/loop` or `ScheduleWakeup` wakeup, a `CronCreate` task or a cloud scheduled task sends), or that carries `pluginPrompt` (a prompt a mod submitted, such as the pane's Submit), opens a turn, unless it's a sidechain's or a compaction's summary. Its id is the first 8 characters of its `promptId`. The user's own text is a prompt they typed, or one whose `pluginPrompt.name` is this plugin's; another mod's prompt and a scheduled prompt are not. A headless run's prompt, `turnOrigin` `sdk`, opens none. A message sent while it ran is a `queued_command` attachment: the user's own is an answer, and an agent's, another session's or a task notification a report. A reminder, a skill's body, a local command, and a `!` shell command and its output open none, so a bare answer after `! git log` answers the reply before it. A prompt record the file repeats folds into the first.
- **The Decide items.** A turn's Decide items are its `kanban_options` call's input, each subject's latest only, none from before the latest `reassess` turn.
- **The count line.** It counts the items of the Pending, Waiting, Authorizations, Review, Todo and Decide lists of the last 20 turns' replies (`counts.turns`), never from before the latest `reassess` turn, each item once however often it's restated.
- **What makes an item Done.** The rules are the skill's own, which calls a Done item settled:
  - a Review item, once every pull request it names with its repository, as a GitHub URL or `owner/repo#N`, has merged. The plugin asks `gh api graphql --hostname github.com` in one call per refresh, within `counts.gh-timeout-ms`, about the pull requests not yet known merged, and keeps the ones it says merged so it never asks about them again. The pane and the count line are drawn without waiting for `gh`, and the count line again when it says one merged, unless a later refresh has started by then. A bare `#N` is never looked up, and a `gh` that is missing, fails or takes too long makes nothing Done;
  - a Decide item, once the user answers its latest restatement in a later prompt or in a message sent while a turn ran, by an option's letter or in words: `9efb08a1.Decide.2.B`, `Decide.2: B of 9efb08a1`, `Decide.2: <words>`, or, for the turn before, a line of numbered answers, `2. B` or `1. A / 3. B`. Only the user's own text answers, the pane's Submit sending the draft among it: an agent's message, another session's message, a task notification, a skill's body, another mod's prompt and a scheduled prompt never do. A line holding a question mark answers nothing;
  - a Waiting item, once a report names it in a turn after the last that printed it in its own list. The user's own text, the pane's Submit among it, is never a report. A report is an agent's message, another session's message, or a task notification for a finished task or an expired Monitor, opening a turn or sent while one ran, naming it by the session's name, the agent's id, or the task's id or quoted name in the item's summary, or by a branch-shaped code span of the summary in the report;
  - every item, by a later `reassess` turn: the user's own prompt, typed or sent by the pane's Submit, never an agent's, another session's, a task's, another mod's or a scheduled message. The line naming the plugin that opens a draft from the pane, `coding-agent-kanban-turns:` or `coding-agent-kanban-turns@<marketplace>:` alone on the first line, is left out first. A command runs from the prompt's opening word, bare or after the skill's slash command: `reassess`, a synonym (`recheck`, `regenerate`, `recalculate`), or a prefix of them no other command's name shares. Failing that, the prompt reassesses when its last line that isn't blank is such a word alone, trailing `.,;:!` allowed, as the pane's Reassess button leaves the draft, with or without answers before it: any answers count, making what they answer Done, and the reassess starts at that turn. Only `reassess` runs from the last line; `open` doesn't. The skill's `outstanding.py` reads a reassess by the same rule.

  The parse that makes a Decide item Done also keeps the answer's letters, its note and the turn it was sent in, for what a Done item says made it Done.

  A 📌 roll-up's restatement of a Done item reopens nothing, however long after its own line has left the count line's turns.

## Developing

See [`AGENTS.md`](AGENTS.md) for the dev shell's commands and what `nix flake check` runs. To try the plugin from a checkout without installing it, build it with the dev shell's `plugin-build` and load the build:

```bash
claude --plugin-dir result-plugin
```

| File                                                           | Holds                                                                                                                                                                  |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`plugin/hooks/register.tsx`](plugin/hooks/register.tsx)       | the hooks: the pane, the count line, a reply's links and buttons, the tools (`kanban_options`, its row, `kanban_outstanding` and `kanban_lint`) and their instructions, the turn-end lint, `/answers`, `/answers-config`, the refreshes |
| [`plugin/hooks/settings.ts`](plugin/hooks/settings.ts)         | reads the defaults file and the user's                                                                                                                                 |
| [`plugin/src/`](plugin/src/)                                   | the pure core, a folder per concern: `protocol/` (the spec's and the fragments' modules, the rules derived from the spec, the fragments' assembly, the agent's instructions, the tools' names, descriptions and schemas), `transcript/` (the turns and what they hold), `items/` (the draft's answers, the items raised and Done, the count line, and what `kanban_outstanding` gives), `lint/` (the reply lint `kanban_lint` and the turn-end lint run), `pane/` (the pane's state and the step function that moves it, the turn sections and the stops its keys move between, the items' layout and links, the cut of a reply's Decide list, the text drawn), `config/` (the settings), `text/` (a string's cells in a terminal, words in a sentence, text escaped as a literal pattern) and `json/` (whether a value is an object, its fields, and JSON parsed without a throw); it reads harness-neutral turns, which the Claude Code adapter, [`transcript/claude-code.ts`](plugin/src/transcript/claude-code.ts), builds from the session's JSONL transcript |
| [`plugin/cli/`](plugin/cli/)                                   | the kanban CLI: its commands over the core, the neutral turns it reads from stdin, and its edge, which the flake bundles into `kanban.js` and the standalone binary     |
| [`plugin/defaults/config.yaml`](plugin/defaults/config.yaml)   | every setting, with its default and what it does                                                                                                                       |
| [`plugin/spec/kanban.yaml`](plugin/spec/kanban.yaml)           | the protocol's checkable rules: the lists, the option kinds, the commands, the reference grammar, the 📌 roll-up, the 🔖 tag and the rule characters, which `spec-build` compiles into `plugin/src/protocol/spec.ts` and `plugin/spec/kanban.json` |
| [`plugin/spec/fragments/`](plugin/spec/fragments/)             | the protocol's prose rules, a Markdown file per topic, each list, glyph or command named by a placeholder the spec fills, which `spec-build` compiles into `plugin/src/protocol/fragments.ts` |
| [`plugin/tools/`](plugin/tools/)                               | the spec's build step, the derived skill's, and the script `plugin-test` runs                                                                                          |
| [`plugin/skills/`](plugin/skills/)                             | the derived skill as the flake builds it, its wrapper aside, committed for a git install; `refresh-skill` lays it there                                                |
| [`plugin/vendor/`](plugin/vendor/)                             | the YAML parser, in a folder of its own, bundled by the flake into one committed ES module with its licence, and its types; `refresh-vendor` lays the flake's bundles there |
| [`plugin/types/index.d.ts`](plugin/types/index.d.ts)           | the item, raised items, neutral turn and settings shapes, and the `$.state` contract                                                                                   |
| [`plugin/test/unit/`](plugin/test/unit/)                       | the core's tests, run by `node --test`, in folders mirroring `src/`, and differential tests of the adapter and the core, of the pane's step function, and of the helpers that replaced the core's copies, against the oracles in `test/oracle/` |
| [`plugin/test/engine/`](plugin/test/engine/)                   | the pane, the count line, a reply's buttons and the tool row driven through the engine, run by `claude plugin test`                                                    |
| [`plugin/test/built/`](plugin/test/built/)                     | the flake's `kanban.js` and binary run on every golden case, which `checks.cli-js` and `checks.cli-bin` run                                                            |
| [`plugin/test/fixtures/`](plugin/test/fixtures/)               | the transcript records, neutral turns and Submit's random events the tests build on                                                                                    |
| [`plugin/test/types/`](plugin/test/types/)                     | the declarations Node's type-check needs in place of the engine's, and the check that the bundled YAML parser's types match its package's                              |
