---
name: coding-agent-kanban-turn-responses
description: "Every response in a turn is kanban-shaped, as the coding-agent-kanban-turns plugin teaches and checks it. A progress update between tool calls is one line whose state emoji show what is done, running and next. The final response is up to 9 underlined, numbered lists of what is new this turn, in a fixed order, Done, Pending, Logged, Waiting, Answers, Authorizations, Review, Todo and Decide, each item's bold summary on its own line, then what earlier turns left open under 📌, in full on an interval, otherwise as one count line. Decide items and their capital-lettered options, `radio` or `checkbox`, each read alone, with pros and cons; an answer that asks a question is answered in its item, never taken as a choice. `scripts/kanban.js` runs the plugin's core: the count line, the roll-up's draft and the reply lint. Load this skill only where the conversation holds no block opening \"This block is the `coding-agent-kanban-turns:coding-agent-kanban-turn-responses` skill's format\", which the plugin's hooks send."
---

# Kanban turn responses

A project may extend the format with a skill of its own, or with its preferences file for this skill, adding its own backlog path or link rules; the project's wins where the two differ.

Every response in a turn shows what is done, what is still open and what the user must do: a one-line progress update between tool calls, and in the final response up to 9 lists in a fixed order, then what earlier turns left open, under 📌 in full or as one count line. Follow these rules for every response in the turn, each progress update and the final response.

**Why:** the user reads a response once and acts on it. A fixed shape lets them see progress as it happens, find their questions, sort the rest by position and answer by reference. A list reprinted every turn is read every turn, so what has not changed rolls up out of the way, and between full roll-ups shrinks to one count line.

**How:** read the user's answers first: a choice is acted on, and a question about an item is answered in that item, restated in its list. Between tool calls, write a one-line progress update when a step finishes or starts. In the final response, write this turn's new items in the non-empty lists, in the lists' order, each header underlined, each numbered item's summary on a line of its own, and each multi-line item parted by a separator line. Close on what earlier turns left open, in full or as the count line, and check the whole draft against the checklist that closes "The shape" before sending it.

## Your preferences

!`cat "${CLAUDE_SKILL_DIR}/../coding-agent-kanban-turn-responses.preferences.md" "${CLAUDE_PROJECT_DIR}/.agents/skills/coding-agent-kanban-turn-responses.preferences.md" 2>/dev/null || true`

If your agent doesn't run the line above, read these files yourself where they exist: `coding-agent-kanban-turn-responses.preferences.md` next to this skill's folder, the user's, then `.agents/skills/coding-agent-kanban-turn-responses.preferences.md` in the project. A project's file wins over the user's, and the user's over this skill's defaults. A file that isn't there is skipped.

## Progress updates

A progress update is any text the agent writes between tool calls before the final response. It is one line, written only when something has changed: a step finished, a step started, or the plan changed. Each step it names opens on its state emoji, the steps parted by a space, `·` and a space, as the count line's lists are, finished first:

```text
✅ the waiver clauses read · 🏃 checking the 2020 resolutions · 💤 the limitation sections
```

| Emoji | State |
| --- | --- |
| ✅ | done |
| 🏃 | running |
| ⏳ | waiting on other work |
| 👀 | waiting on the user |
| 💤 | not started, nothing in its way |
| ❌ | failed or abandoned, with why in a few words |

⏳ also heads the Waiting list, since both mean waiting on something other than the agent and the user.

A step names its subject, never its category: "the 2020 resolutions", not "the documents". A progress update carries no lists, no 📌 roll-up and no decisions; anything that needs the user waits for the final response, unless the work cannot go on without it.

## The final response's lists

The final response's lists, in the order it prints them: Done, Pending, Logged, Waiting, Answers, Authorizations, Review, Todo and Decide.

| Header, written exactly so | Holds, from this turn only | Waits on |
| --- | --- | --- |
| ✅ **Done:** | one item per change, with its file and commit; a clean check, with what it checked and the count | nobody |
| 🚧 **Pending:** | the agent's own work started and not finished, scope left out, a hold that will not announce itself when it lifts | the agent |
| 📝 **Logged:** | one item per entry written into the project's backlog, by index and title | the next agent |
| ⏳ **Waiting:** | a background shell, subagent, hand-off or expected message, and what the session does with its result | the thing itself |
| ❓ **Answers:** | one item per question the user asked that names no listed item, the question as the summary, shortened or reworded where that reads better, the answer under it | nobody |
| 🔑 **Authorizations:** | one item per grant only the user can give: a 1Password, SecretSpec or SSH signing prompt, an approval for actions the harness or a classifier refused, a `sudo` password | the user |
| 🔍 **Review:** | one item per thing put in front of the user to read, listen to or look at, a pull request to review or merge among them, with where to open it and what to look for | the user |
| 👉 **Todo:** | one item per action asked of the user that is not a choice, reading or grant: a file to mark up, a prompt to paste, a command to run; each says what to do and where, by its path, and ends on its `Frees:` line where it frees a listed item | the user |
| 🧠 **Decide:** | one item per decision raised, and per judgement call taken instead of asked, its reversal an option | the user |

The Pending, Waiting, Authorizations, Review, Todo and Decide lists' items roll up into 📌 until something settles them: an Authorizations item until it is granted or withdrawn, and a Review item until the user's reply shows they reviewed it. The Done, Logged and Answers lists' items never roll up.

An empty list is left out, and the final response opens on a line of prose. An answer takes the shape its information has: a comparison is a table, a sequence is numbered steps, parallel items are a list. A table never goes inside an item, where it prints as raw pipe rows: it goes after its list's last line and blank line, under a line naming the item, such as `Answers.3:`, then a blank line, the table, and a blank line before the next list's header. A table always has a blank line above and below it, since a line directly under its last row is drawn as one more row.

**A list holds only what is new this turn.** An item an earlier turn printed, unchanged since, is not printed in its list again; it rolls up into 📌. An item whose state changed this turn, a Waiting agent that reported, a Todo item whose prompt is now ready or an item whose question was answered, is new again and is printed in its list with the change.

**Which list.** A review that is itself a choice goes in 🧠 Decide, a task that is not a reading goes in 👉 Todo, and a grant only the user can give goes in 🔑 Authorizations.

**An authorization is a grant, not a task or a choice.** A 👉 Todo item asks the user to do something, a command to run or a file to mark up, and a 🧠 Decide item asks them to choose. A 🔑 Authorizations item asks for what only the user can give, a password, a touch or an approval, often against a prompt that times out, and the work behind it stops until they give it. A `sudo` command or a system switch the user runs for their password is an authorization, since what it waits on is the password, and the command goes on a line of its own after `💻 ❯`. The summary leads with what the grant unblocks, the tag, branch, token or command, never only the kind of prompt, so two grants of one kind stay two items in the 📌 roll-up. Each item says where to grant it, the prompt's window or the approval message to send, how long the prompt stays open and what granting it frees, and lists what it covers, such as the pull requests or commands one grant covers, as a nested list under its summary; the prompt's state goes in the item's body, never its summary, which the roll-up reprints. The Authorizations list leads the lists that wait on the user, since what it holds blocks running agents.

**A pull request is a Review item.** A pull request the user is asked to review or merge goes in 🔍 Review, by its canonical label, its number and title, linked, with what to check in it. When this turn's work opened it, the ✅ Done item for that work names the change in a line and points at the Review item by reference, `see Review.1`, without repeating the pull request's label, link or contents, so the pull request is described once.

**A turn reply is a delta.** Each ✅ Done item states the state reached, such as "`retries`: 3 → 5 in `config.toml`", never the actions taken to reach it.

**An item that reports on many things is grouped and layered.** The result of a run over many repositories, files or checks opens on its totals and names what needs action, then gives the groups with their counts, the groups that need the user first. A group that needs nothing from the user is its count and the file or command that lists it, and its items are printed when the user asks for them.

## The shape

- **Header:** the header line ends in a hard line break, two spaces. The line under it holds one `▔` U+2594 per column of the header, the emoji counting 2, so `⏳ **Waiting:**` takes 11 and `🔑 **Authorizations:**` 18. The first item follows on the next line.
- **Item:** a numbered item opens on its summary, in bold, alone on its line and ending in a hard line break; the rest of the item starts on the line beneath, at the column the summary starts at. The summary is a phrase, or the question for an Answers or a Decide item, with no trailing colon, since nothing follows it on its line. It names its subject, never its category, and the item to do first leads. A summary that says all there is, such as a check that passed, is the whole item. A bullet, such as a 📌 roll-up item, keeps its summary and text on one line. A Done item comes from the commit or the run output, never from memory. No item points back with a phrase like "the quotes" or "those episodes": each names what it means by its label, since what set it up has scrolled away.
- **Parts:** an item holding several things the user acts on, or several parallel parts, lists them under its summary as a nested list, one to a line, never joined in a sentence. A Decide item's options keep the shape "A Decide item" gives them.
- **Figures:** a figure in an item, a count, size or duration, is the output of a query run in the same turn that reads the state it counts, never a tally of lines the session saw go by, and the item names the query beside it: ``4 of 6 runs ok (`run_headless.py --summary --job night`)``. A figure no query can give is an estimate, and the item says so: `about 20 min (estimate)`.
- **Numbering:** each list numbers from 1 and nothing else in the final response is numbered except an item's own steps, so `Decide.2` names one thing. A second final response to the same prompt continues the numbering, and so does each topic of a response grouped by topic.
- **Separator:** in every list, the 📌 roll-up included, a multi-line item is parted from each neighbour by a separator line: the list's indent, U+2800 `⠀`, and nothing else, directly under the item's last line, with no blank line beside it inside the list. Since a summary has its line to itself, every item with more than its summary is multi-line, every Decide item among them. Items that are only their summary sit together, and the first item follows its header with no separator.
- **End of a list:** a list ends at a blank line. One blank line goes after a list's last line, its last separator line if it has one, and before whatever header follows: the next list's, a 📌 roll-up group's, the 📌 header or the count line. Without it, Markdown reads the header as more of the last item's text, and the next list continues the same numbering, so `Todo.1` renders as the 8th item.

Two lists in one response, each ended by a blank line, then the count line:

```text
✅ **Done:**  
▔▔▔▔▔▔▔▔
1. **Tokenizer fix in commit `a1b2c3d`**  
   ⠀
2. **Test suite rerun after the fix**  
   412 passed and 0 failed, in 3 minutes.
   ⠀

👉 **Todo:**  
▔▔▔▔▔▔▔▔
1. **Rotate the `deploy-bot` key in the cloud console**  
   It was issued before the leak, and rotating it frees the release.

📌 Outstanding: 🚧 1 · ⏳ 2 · 🔑 3 · 🔍 4 · 👉 5 · 🧠 6
```

Before sending a final response, check the draft for each of these and fix every one:

- a missing or misplaced separator line, a line of other whitespace where one belongs, or a blank line beside one inside a list;
- text after a numbered item's summary on its line, or a summary line with no hard line break;
- a list among a Decide item's options;
- a 👍 or 👎 option, or one lettered `Y` or `N`;
- a header or topic underline of the wrong width;
- a list under a topic that does not number on from the topics before;
- a header written directly under a list, with no blank line between;
- a table inside a list item, or a table without a blank line above and below it.

## A Decide item

- **Options:** they follow the item's summary and its note, recommended first, each on one line, as `glyph letter. **name**: consequence`. The letter is a capital, `A`, `B`, `C`, never a number or a lower-case letter: an answer like `1.B` then cannot be misread, since the number always names the item and the capital the option, and a typo lands on no option instead of the wrong one. The AskUserQuestion picker, when it opens, lists the same options in the same order.
- **Pros and cons:** every option carries, indented under it, a ➕ line for what it gains and a ➖ line for what it costs; the recommended option's ➕ says why. ✅ and ❌ are kept for the Done header and the done and failed states, so a pro line never reads as finished work.
- **Notes:** a note on the whole item is the line under its summary, and a note on one option goes under that option, in plain lines at its ➕ and ➖ lines' indent. A note among the options is never a `-` or `1.` list: the option lines are plain lines of the item's paragraph, so a list there captures every line after it, the later options among them, and prints them at its own indent.
- **Each item and option stands alone.** Read with nothing above it, the summary names the thing decided and each option names what it acts on and what it does to it: the entry number and its title in a few words, the file, branch, table or step, the count. A label that only points back, "the 4 gate bugs", "the fix above", "part S", says what it points at in the same line, "entries 0819, 1375, 0988 and 1374, the stale-database and stale-render bugs".

An item's kind is the glyph its options open with:

| Glyph | Kind | Options chosen | Letters |
| --- | --- | --- | --- |
| 🔘 | radio | one | `A`, `B`, `C` |
| 🔲 | checkbox | any, none included | `A`, `B`, `C` |

A pair of courses answered with a label is a 🔘 radio item. A yes-or-no question is a 🔘 radio item too, with both answers written as options, `A` and `B`, the recommended one first, each naming what it does, never a bare "yes" or "no": with one answer form for every item, `Decide.2: B` names an option the same way whatever the question.

A Decide list in this shape, a checkbox item and a yes-or-no question as a radio item, its recommended answer first as `A`:

```text
🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **Backlog cleanups to start, of 260 entries in the backlog**  
   Any of 2. Note on the whole decision: the figures, the words at issue.
   🔲 A. **Entry 1411, the 4 quotation matchers made one**: one matcher for the loader, the render and the checks.
      ➕ A citation lands or fails the same way everywhere.
      ➖ About 1M tokens, and it waits for `case-law-load`, which edits the same code.
   🔲 B. **Entries 0550 and 0455, dead code**: delete `findings_sources.py`.
      ➕ About 0.1M tokens.
      ➖ Nothing gained but tidiness.
   ⠀
2. **Ship the 2.4 release tonight?**  
   The release notes are written and the checks pass.
   🔘 A. **Ship it tonight**: tag `v2.4` and publish.
      ➕ Users get the tokenizer fix a day sooner.
      ➖ Nobody watches the rollout overnight.
   🔘 B. **Hold it for the morning**: tag and publish at 9.
      ➕ The rollout is watched.
      ➖ The fix waits a day.
```

## What an item frees

An item that blocks other work ends on a line naming, by reference, the items it frees, in place of saying in words what it frees: `Frees:`, then each item's reference, parted by `,` and a space, `Frees: 0f311c94.Decide.2, 0f311c94.Review.1`.

- **Which items:** each is an item of the Pending, Waiting, Authorizations, Review, Todo and Decide lists, of this turn or an earlier one, that can't go ahead until this item settles, never the item itself. Work that no listed item names is said in words in the item's body.
- **After `reassess`:** a turn that ran `reassess` replaced every earlier item, so name the item that took an earlier one in, never the earlier one, which frees nothing.
- **Each reference** is `<turn>.<List>.<n>`, the turn id always written, this turn's included, in full or as its first 6 characters or more, with no letters and no note.
- **Where:** the line is the item's last, at the column its summary starts at, under its body, a Decide item's under its last option, and directly above its separator line. An item that frees no listed item has no such line.

A Todo item that frees a Decide item and a Review item:

```text
👉 **Todo:**  
▔▔▔▔▔▔▔▔
1. **Paste the release prompt into the deploy session**  
   It is in `prompts/release.md`.
   Frees: 0f311c94.Decide.2, 0f311c94.Review.1
```

## The user's answers

- **By reference:** the user names an item by its list and number, `Decide.2`, an option by its letter, `Decide.2: B` or `2. B`, and either by its name. A note may follow the letter, `Decide.2.B: <note>`, and words after the colon with no letter, `Decide.2: <words>`, answer the item in the user's own words; read either as part of the answer, and a note holding a question as a question about the item. An item of an earlier turn carries that turn's id, from its usage line, before or after: `0f311c94.Decide.2` or `Decide.2 of 0f311c94`; with no id, the last final response is meant. An answer to an item of a turn that `reassess` replaced is read against the item that took it in.
- **Only the user's own text answers:** the prompts they type or send with the coding-agent-kanban-turns pane's Submit button, and the messages they send while a turn runs; an agent's report, a task notification, a skill's body or another mod's prompt answers nothing, even when it names an item.
- **A question is never a choice.** An answer holding a question mark or any question, `Decide.1?`, `B?`, "how would B work?", "why not C?", asks about the item and picks nothing, even when it names an option. Restate the item in its own list, whatever the list, with the answer as the note under its summary and its options rewritten where the answer changes them; the item stays open until the user answers it without a question. A question goes in ❓ Answers only when it names no listed item.
- **A Review item stays open until the user's reply shows they reviewed it:** they comment on it, answer from it, or say they looked; a reply that only answers something else leaves it open.
- **An Authorizations item stays open until it is granted or withdrawn:** the prompt is answered or the approval sent, or the session no longer needs it and says so in its Done list. A grant the session cannot see, a password typed in the user's own terminal, closes when the user says it is granted, naming it as `Authorizations.3`. A prompt that timed out unanswered is raised again and restated in its list, or withdrawn.

## Earlier turns' items

The final response closes, before any ETA line, on what earlier turns left open and no later turn settled: every 🚧 Pending, ⏳ Waiting, 🔑 Authorizations, 🔍 Review, 👉 Todo and 🧠 Decide item. It prints in full or as one count line, by the roll-up interval. The commands `count` and `rollup` of `scripts/kanban.js` draft both from the session's transcript: the count line as it prints, and the full roll-up, with each item's 🔖 tag, to prune of what is settled.

**The roll-up interval.** The full roll-up prints once min(30 min, 5 × the average duration of the last 5 completed turns) has passed since the last final response that printed it in full; otherwise the final response closes on one count line.

- A prompt is any turn the user sees a usage line for, an agent's report and a task notification included.
- A turn's duration runs from its prompt to the next turn's prompt, so it covers the final response and the user's reading, and only a turn the next prompt has closed is completed.
- A final response that printed the count line does not restart the clock, and a session with no full roll-up yet prints it in full.

**The count line** names each list by its glyph and count, in the lists' order, Pending, Waiting, Authorizations, Review, Todo and Decide, each list left out when empty: `📌 Outstanding: 🚧 1 · ⏳ 2 · 🔑 3 · 🔍 4 · 👉 5 · 🧠 6`.

**The full roll-up** has the header `📌 **Outstanding from previous turns:**`, underlined with `━` U+2501, one per column, 35 in all, so the heavier rule sets it apart from this turn's lists. Under it the items are grouped by the list they came from, each group under that list's own header, in the lists' order and with no underline, and a blank line before each group's header but the first. Each item is one bullet, never numbered, naming its subject in a line and never reprinting its options, and ends with its 🔖 tag. Leave out what is settled: a Review item whose pull requests have merged, a Decide item the user answered, a Waiting item whose report came, and anything else a later turn closed.

```text
📌 **Outstanding from previous turns:**  
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⏳ **Waiting:**  
- **The nightly test run**, on the build machine 🔖 0f311c94₋₃

🧠 **Decide:**  
- **Backlog cleanups to start, of 260 entries in the backlog** 🔖 0f311c94₋₃
```

**The 🔖 tag** is `🔖`, a space, the turn id as plain text, and the relative index in subscript right beside it, `🔖 0f311c94₋₃`. Only a 📌 item carries it; the other lists print neither the turn id nor the index.

- **The turn id** is the first 8 characters of the `promptId` of the turn whose final response first printed the item; where an item was restated with changed substance, it is the turn that restated it.
- **The relative index** is that turn's position counting back from the current turn, 0, every turn the user sees a usage line for counted. It prints as `₋` then the subscript digits `₀₁₂₃₄₅₆₇₈₉`: `₋₁₇` is 17 turns back.

**Nothing open, nothing printed.** With nothing open the final response has neither the full roll-up nor the count line. A turn that runs `reassess` prints neither, since its lists replace every earlier turn's.

## The commands

| The user writes | The final response |
| --- | --- |
| `open` (or `pending`, `restate`) | reprints the open 🔑, 🔍, 👉 and 🧠 items of earlier turns as written, grouped by topic |
| `reassess` (or `recheck`, `regenerate`, `recalculate`) | works out afresh which are still open, and prints them grouped by topic |
| `Expand <list>.<n>[.<letter>]`, or an item from 📌 by its subject | reprints that item or option at the depth its list needs |

A prompt opening on a command's name runs it. A prefix of a command's name runs that command too, where it is a prefix of no other command's name, so `rea` runs `reassess` and `re` runs nothing. Only the user's own prompt runs a command, typed or sent with the coding-agent-kanban-turns pane's buttons; an agent's report, a task notification or another mod's prompt that opens on a command's name runs nothing. A prompt of the user's that ends on a line naming `reassess` alone, as the pane's Reassess button leaves its draft, runs it too, with or without answers before it: take any answers first, then run it with them settled. `open` never trails. The `coding-agent-kanban-turns@<marketplace>:` line a draft from the pane opens with is neither an answer nor a note.

Both `open` and `reassess` leave out an item a later turn settled or made moot, a Todo item as much as a Decide one, and an Authorizations item once granted or withdrawn, and print into the 🔑 Authorizations, 🔍 Review, 👉 Todo and 🧠 Decide lists, never ❓ Answers.

**`open`: the open items as they were written.** The items are reprinted with their wording and options unchanged, so the user can answer the items they were already shown; a Todo item keeps its path and what it frees. Each names the turn and item it came from, `(from 0f311c94 2.C)`. The earlier turns stay open, rolled up as before. Grouping only moves the items under their topics and renumbers them. A Decide item an older reply wrote with 👍 `Y` and 👎 `N` options is reprinted with them as 🔘 `A` and `B`, in their order, its source naming the letter it was printed with.

**`reassess`: the open items, worked out afresh.** It reads the same items and the work's state now: what has landed, what is running, what has been learnt since. The earlier items are evidence of what is undecided, not a structure to keep, so the reassess takes no item's wording, grouping, numbering or options as given:

- **Merged:** items that are one decision become one item, such as a sending date raised in one turn and what the send waits for raised in another.
- **Split:** an item that holds 2 decisions becomes 2 items.
- **Dropped:** an item that the state of the work has settled or made moot is left out.
- **Changed:** an option whose cost or gain has changed since is rewritten with today's figures.
- **Added:** a decision the work's state now needs, and that no earlier item asked, is raised.
- **Reordered:** within its topic's list, the decision that gates the most work is printed first.

Each Decide item follows the rules for a Decide item; each Todo item still open stays an action of the user's with its path and what it frees, merged only where 2 ask the same action. The lists of a turn that runs `reassess` replace every earlier turn it read: the turn prints no 📌 roll-up, and the next roll-up holds that turn's items and later ones alone.

**`Expand`: one item at the depth its list needs.** An expanded item, or option, holds what the user needs to act on it without reading anything else, and is printed in its list as new this turn; its expansion is the item's wording from then on. An expanded option expands the same way, under its own item's summary.

| List | An expanded item gives |
| --- | --- |
| 🔑 Authorizations | what the grant is and what asks for it, where to give it, the prompt's window or the exact approval message to send, when it times out, everything it covers as a nested list, and what granting it frees |
| 🔍 Review | what the thing is and why it is up for review, where to open it as a link they can click, what to look for, and what their review frees |
| 👉 Todo | numbered steps; enough context to find the thing, its name as it appears where they will look for it, a date or a size that tells it from its neighbours; and every link or text they need, in the form its destination takes: a URL to click, a command or a prompt in its own `text` block to copy, a path from the repository root |
| 🧠 Decide | what the thing being decided is and how it came up, the facts each option turns on, with figures from the database or the run, what each option does and costs, which one is recommended and why, and what happens if they do not decide |

**Grouped by topic.** `open` and `reassess` group their lists under topics, each topic one unit of work as the user thinks of it: a repository, a plan, a pull-request stack, a workstream.

- **Topic header:** the topic's name in bold, alone on its line and ending in a hard line break, and under it one `═` U+2550 per column of the name. The topic's lists follow straight under it in the lists' order, each with its own header and `▔` underline, a list with no items in the topic left out. A blank line ends a topic's last list, before the next topic's header.
- **Which topics:** sort the items into topics by their content. A topic needs 3 items to stand alone, and the rest go under `Miscellaneous`, always last; there are at most 6 topics. The topic with the most to decide or do comes first. A `reassess` keeps the topic names of the previous `reassess` for the items carried over from it.
- **Numbering:** each list numbers on across topics, so where the first topic's Decide list ends at 3 the next topic's starts at 4, and `Decide.4` still names one item.

The 📌 roll-up and every other final response are not grouped.

## Around the lists

- **Turn ids:** a turn id is the first 8 characters of the prompt's `promptId`, `0f311c94`, shown on the prompt's usage line.
- **Time:** say how long work takes, never when it lands or goes out, and set no deadline.
- **Tables:** a plain Markdown table, never a box table in a `text` block. A cell holding a state holds its emoji from the progress-update table, not a word.
- **Links:** every URL, a local served page as much as a web page, is a Markdown link opened by 🔗 and a space, `🔗 [the trial projection](http://127.0.0.1:8765/…)`, kept out of `text` blocks. In a table's cell the link goes without the 🔗, its label short enough not to wrap.
- **Glyphs:** the only ones in a response are the 9 header glyphs, `▔`, `═`, 📌, `━` and 🔖, the `·` between the count line's lists and a progress update's steps, the 6 state emoji, ⏳ among them being also the Waiting header's glyph, the 2 option glyphs, ➕ and ➖ on a pro or con line, 🔗 before a link, `💻 ❯` and `✴️ ❯` before a command for the user to run, and the separator character. A new one is checked for its width in a terminal before it is used.

## The scripts

This skill's `scripts/` folder holds the coding-agent-kanban-turns plugin's kanban CLI: the core functions the plugin's hooks and tools call, bundled, so the count line, the roll-up and the lint here are the plugin's own. Run it by its path in this skill's folder, which Claude Code gives as `${CLAUDE_SKILL_DIR}`.

- **`scripts/kanban.js`:** the CLI as one JavaScript file, run with Node 20 or newer: `node "${CLAUDE_SKILL_DIR}/scripts/kanban.js" <command>`. Use it wherever `node` is on the path.
- **`scripts/kanban`:** the same CLI, run by the Node a Nix install of the plugin brings: `"${CLAUDE_SKILL_DIR}/scripts/kanban" <command>`, for where `node` is missing. It finds `kanban.js` beside itself by the path it is run by, so run it by that path, not through a symlink to it elsewhere. Only a Nix install carries it; a copy of the plugin from git has `scripts/kanban.js` alone.

Each command reads the session's turns, from one of:

- **This session's transcript:** with neither option below, in a Claude Code session, which sets `CLAUDE_CODE_SESSION_ID`: the session's file in Claude Code's `projects/` folder, under `CLAUDE_CONFIG_DIR` where it's set and `~/.claude/` otherwise, in the working directory's project folder, else the one project folder that holds it.
- **A transcript:** `--transcript <path>`, a session's file, as Claude Code writes it to `~/.claude/projects/<project>/<session>.jsonl`.
- **Stdin:** `--stdin`, or with no session and no `--transcript`, a JSON list of neutral turns, `[{"id": ..., "prompt": {"owner": "user", "text": ...}, "replies": [...]}]`, the turn ids as references write them, for a harness whose transcript the CLI doesn't read.

In any harness but Claude Code, always pass `--stdin` or `--transcript`: a process started from inside a Claude Code session inherits its `CLAUDE_CODE_SESSION_ID`, so without either the CLI would read that session's transcript, another conversation's.

When to run it:

- **Before a final response that closes on what earlier turns left open:** `due` says whether the full 📌 roll-up is due by the roll-up interval, `full`, or else `counts` and the time until it is. Then `rollup` gives the full roll-up's draft, with each item's 🔖 tag, to prune of what is settled, or `count` the count line as it prints.
- **Before sending a final response:** `lint --draft -`, with the draft on stdin, and fix every line it reports. With no `--draft`, `lint` checks the last final response in the turns.
- **For a reference's turn id:** `turn-id` gives the current turn's.

The CLI's usage, as `--help` prints it:

```text
Usage: kanban <command> [--transcript <path> [--harness <name>]] [options]

Commands:
  count     the 📌 count line, empty when nothing is outstanding
  rollup    the full 📌 roll-up, each item ending in its 🔖 tag, empty when nothing is outstanding
  due       whether the full 📌 roll-up is due by the roll-up interval: full, or counts and the time until it is
  lint      the reply lint's findings for a draft (--draft) or the last final response, exiting 1 when there are any
  turn-id   the current turn's id, the latest turn's

The turns are read from the transcript at --transcript, as the harness --harness names
writes it (claude-code; claude-code unless named); else, where CLAUDE_CODE_SESSION_ID
names a Claude Code session, from its transcript in the projects/ folder of CLAUDE_CONFIG_DIR
or ~/.claude/, in the working directory's project folder or the one that holds it; else, or
for --stdin, from stdin, as a JSON list of neutral turns. A child process inherits the
session's CLAUDE_CODE_SESSION_ID, so another harness passes --stdin or --transcript always.
A turn's unanswered, true where it has no final response, keeps lint off its replies; its
promptedAt and answeredAt, ISO 8601 times, time due.

Options:
  --transcript <path>  a session's transcript
  --harness <name>     the harness that wrote it: claude-code
  --stdin              read the turns from stdin, even in a Claude Code session
  --window <n>         how many of the latest turns to read; 0 reads every turn since the latest reassess
  --width <n>          how long a roll-up item's summary may be; 0 keeps summaries whole
  --merged <pr>        a pull request known merged, owner/repo#N or its URL; once per pull request
  --draft <path>       lint: the draft to lint, - for stdin, in place of the last final response
  --json               lint: the findings as JSON, {"findings": [{"line", "rule", "detail"}]}
  --help               this usage

The window and the width default to the plugin's settings, its defaults/config.yaml with
the user's own config.yaml merged over it.

Exit codes:
  0  done
  1  lint found something
  2  the arguments, the input or the settings can't be used, as stderr says
```

## Worked examples

Each file in this skill's `examples/` folder is one of the coding-agent-kanban-turns plugin's golden cases: a transcript of turns, each prompt and response as written, then what the plugin's core gives for it: what is still outstanding under 📌, the count line, and what each item's `Frees:` line frees. The plugin's tests run every case through its core and its lint, so each response holds the format as this skill gives it.

- [examples/commands-by-every-name.md](examples/commands-by-every-name.md): Each name of each command runs it, as the prompt's first word, as a prefix no other command shares, or after the skill's slash command; a `reassess` turn's lists replace every earlier item, and it prints no 📌; an `open` turn reprints the open Decide item as written and replaces nothing; and a peer's `reassess` runs nothing
- [examples/decide-answered-by-reference.md](examples/decide-answered-by-reference.md): Answers naming the turn by its id, or by a prefix of it, settle the Decide items they pick, and the item nobody answered stays open
- [examples/decide-numbered-answers.md](examples/decide-numbered-answers.md): A line of numbered answers settles the turn before's items it numbers, and an agent's message giving answers settles nothing
- [examples/every-list.md](examples/every-list.md): A reply printing all 9 lists, then a full 📌 roll-up restating two of its items: the lists that roll up count once each, in the spec's order, and Done, Logged and Answers count never
- [examples/frees-across-reassess.md](examples/frees-across-reassess.md): A `reassess` turn's lists replace every earlier item, so a `Frees:` line after it frees only the items of the `reassess` turn and later ones: a reference to an item it replaced frees nothing, and the item that took it in is named instead
- [examples/frees-on-several-lists.md](examples/frees-on-several-lists.md): Items of four lists, Pending, Authorizations, Todo and Decide, end on a `Frees:` line naming items of their own turn, a Decide item's under its last option, and a later turn's names an earlier turn's item by a prefix of its id: each item frees what its line names, by the turn's whole id, and the Decide item's line wins over the `frees` the plugin's buttons were given for it
- [examples/frees-shared-prefix.md](examples/frees-shared-prefix.md): Two turns whose ids share their first 6 characters: a reference by that prefix names the latest of them, at or before the item's own turn, that holds the item, so it names the later turn's Todo item and the earlier turn's Review item; and a Decide item whose reply writes no `Frees:` line frees what the plugin's buttons were given for it
- [examples/plugin-skill-command.md](examples/plugin-skill-command.md): The plugin's own skill command, the plugin's name, a colon and the skill's, runs the command after it, typed or as the command record Claude Code leaves: a typed `reassess` replaces every earlier item, and an `open` sent as a command record reprints the open Decide item and replaces nothing
- [examples/reassess-after-answers.md](examples/reassess-after-answers.md): A draft the pane's Submit sent, its answers then a `reassess` line, runs `reassess`: the item it answers isn't asked again, and the rechecking turn's lists, the other item worked out afresh among them, replace every earlier item
- [examples/waiting-settled-by-report.md](examples/waiting-settled-by-report.md): A report names a Waiting item, by a name it goes by or the item's branch, and settles it; the user's own text naming an item settles nothing
