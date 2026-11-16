# coding-agent-kanban-answers

A Claude Code mod that makes the Decide items of the [`coding-agent-kanban-turn-responses` skill](../../skills/coding-agent-kanban-turn-responses/SKILL.md) clickable. A click writes the answer's reference, such as `9efb08a1.Decide.2.B`, into the prompt draft and never sends it, so you can pick several answers, add words of your own and press Enter when you're ready.

## Install

At the prompt of a terminal session:

```text
/plugin install coding-agent-kanban-answers --marketplace nhooey/coding-agent-skills
```

Answer `y` to add the marketplace, then choose a scope. From a shell:

```bash
claude plugin install coding-agent-kanban-answers --marketplace nhooey/coding-agent-skills
```

The mod reads the open items with the skill's `scripts/outstanding.py`, and only the copy beside it in this repository, `skills/coding-agent-kanban-turn-responses/scripts/outstanding.py`, so the mod and the script always come from the same commit. That copy is there when the mod runs from a checkout (`skills-dev mods try`, or `claude --plugin-dir plugins/coding-agent-kanban-answers`) or from the marketplace's clone. Anywhere else the band stays empty and `/answers` says why. It runs `python3` from your `PATH`.

## What it draws

### The band above the prompt, or a pane

The band shows one open Decide item at a time, inside a rounded border, laid out as the skill writes it, when every open item fits the rows it has. In fullscreen that's at most half the terminal, the prompt included. When an item is too tall, the band folds to `🧠 3 open decisions, too tall for here 🪟 Open in a pane`, and the button opens a pane beside the transcript with the same drawing at full height. `/answers` always opens the pane. A render hook can't open a pane by itself, so the band can't move an item there unasked.

```text
╭──────────────────────────────────────────────────────────────────╮
│ h: ⏪ Prev  j: ⏭️ Skip  l: ⏩ Next  🔄 Reassess  q: ❌  ● ◎ ○ ○ ○  │
│                                                                  │
│ 🧠 2/5 · Which cache to keep for the loader                      │
│    Both are already built; this only picks the default.          │
│    🔘 A. Keep the disk cache: it survives restarts.              │
│       ➕ Faster cold starts.                                     │
│       ➖ Disk use.                                               │
│    🔘 B. Keep the memory cache: simpler.                         │
│       ➕ Less code.                                              │
│       ➖ Slow cold starts.                                       │
│    ✏️ Notes, or an answer in your own words                      │
╰──────────────────────────────────────────────────────────────────╯
```

Each part has its own colour from the theme, so it reads in light and dark themes alike: the title in the accent colour, code spans in another and the option the draft picks on a highlighted background. The ➕ and ➖ lines are plain text, as in a reply, and part of their option: a click on any of an option's lines picks it, and they light up together under the pointer. The controls sit on top, so they stay put whatever the item's length, and the controls' words are underlined. Every item is drawn in full, its note and every ➕ and ➖ line, however many rows that takes.

| Control         | What it does                                                                                                                                                                                        |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| an option       | writes `<turn>.Decide.<n>.<letter>` into the draft, replacing the item's earlier answer there, and moves to the next unanswered item                                                                |
| `✏️` notes      | on Enter, writes what you typed after the item's reference, on a line of its own: `<turn>.Decide.<n>.B: <note>` with a letter picked, or `<turn>.Decide.<n>: <text>`, an answer in words, with none |
| a checkbox item | toggles its letter in one reference, `…Decide.3.A,C`, and stays on the item so you can pick more; `⏩ Next` or `⏭️ Skip` moves on                                                                   |
| `⏭️ Skip`       | goes to the next item the draft doesn't answer                                                                                                                                                      |
| `⏪ Prev`       | goes to the previous item, wrapping round                                                                                                                                                           |
| `⏩ Next`       | goes to the next item, wrapping round                                                                                                                                                               |
| `🔄 Reassess`   | submits the skill's `reassess` command, which works the open items out afresh; the one button that sends a prompt                                                                                   |
| `❌`            | folds the band to a single `🧠` until a reply raises a Decide item it hasn't shown, until you click the `🧠`, or until you run `/answers`                                                           |

The circles after the controls show which items the draft answers, `●` answered and `○` not, the shown item ringed, `◉` or `◎`, in the accent colour. Click a circle to go to its item. The band refreshes when a reply finishes.

The hotkeys work only where the keyboard is. The prompt holds it by default, so letters typed there stay in the prompt. The pane takes the keyboard as it opens, from `🪟 Open in a pane` or `/answers`; for the band, press ctrl+x then tab, or click it. Then `h`, `j`, `l` and `q` press `⏪ Prev`, `⏭️ Skip`, `⏩ Next` and `❌`, as their labels show, and Escape gives the keyboard back to the prompt. Options have no hotkey, so they read exactly as the skill writes them; click them, or move the focus to one and press Enter.

### Bringing the band back

Submitting a prompt folds the band to its `🧠` and closes the pane while the reply runs, and the reply's end shows the band again if any item is still open. After `❌`, which also closes the pane, while any Decide item is open, the band leaves a single clickable `🧠` where it stood. Clicking it shows the band again, and `/answers` opens the pane, at the first item the draft doesn't answer, and re-reads the open items. With no item open, the `🧠` goes too, and `/answers` says there is nothing to answer.

### Buttons in the transcript

The mod registers the tool `kanban_options`, listed as `mcp__coding-agent-kanban-answers__kanban_options`. The skill tells the agent to call it with the turn's Decide items right before writing its final response, so the tool's row, with each item drawn in its own border as the band draws it, sits just above the reply. The row draws only the items, with each option's consequence, ➕ and ➖ lines when the call passes them; the call's input and result show in ctrl+o, or when the call failed, and so does the result line where it's drawn apart from the row, as after a compaction. Its buttons write the draft as the band's do. Once a refresh finds an item no longer open, its row is dimmed, marked `(settled)`, and its buttons do nothing.

### Questions in a reply

Each open item's summary line in a reply, such as `1. **Which cache to keep**`, is drawn as a link. Clicking it shows the band at that item. The link points at `https://kanban-answers.invalid/<ref>`, a name that never resolves, and the stored reply is unchanged, so ctrl+o shows it as written.

## Where the items come from

The mod never parses Markdown. It runs `outstanding.py --session <id> decide --json`, which lists each open Decide item as:

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

under `{"items": [...]}`. The `kanban_options` tool takes the same object. The skill's [scripts.md](../../skills/coding-agent-kanban-turn-responses/scripts.md) says what counts as open.

## Developing

From the repository's dev shell:

```bash
skills-dev mods check coding-agent-kanban-answers
```

It runs [`skills-dev`](../../scripts/skills_dev.py), which with no name checks every mod in the repository: `claude plugin validate`, `tsc -p` and `claude plugin test`. `tsc` needs the Claude Code API declarations in `.claude-plugin/types/`, which the engine lays there when it loads the mod from a folder it watches; where none has, the tool copies the running build's from the files its `plugin-authoring` skill wrote. To try the mod without installing it:

```bash
skills-dev mods try coding-agent-kanban-answers
```

| File                                       | Holds                                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| [`hooks/register.tsx`](hooks/register.tsx) | the hooks: the band and its `🧠`, the tool and its row, `/answers`, the refresh after each reply |
| [`hooks/answers.ts`](hooks/answers.ts)     | the pure core: how a click changes the draft and how the band moves                              |
| [`types/index.d.ts`](types/index.d.ts)     | the item shape and the `$.state` contract                                                        |
| [`tests/`](tests/)                         | the core's tests, and the band and tool row driven through the engine                            |
