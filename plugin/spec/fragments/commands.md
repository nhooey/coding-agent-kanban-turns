## The commands

| The user writes | The final response |
| --- | --- |
| {{command.open}} | reprints the open {{lists.authorizations.glyph}}, {{lists.review.glyph}}, {{lists.todo.glyph}} and {{lists.decide.glyph}} items of earlier turns as written, grouped by topic |
| {{command.reassess}} | works out afresh which are still open, and prints them grouped by topic |
| `Expand <list>.<n>[.<letter>]`, or an item from {{roll-up.glyph}} by its subject | reprints that item or option at the depth its list needs |

A prompt opening on a command's name runs it. A prefix of a command's name runs that command too, where it is a prefix of no other command's name, so {{command.reassess.prefix}} runs {{command.reassess.name}} and {{command.reassess.shared-prefix}} runs nothing. Only the user's own prompt runs a command, typed or sent with the {{plugin}} pane's buttons; an agent's report, a task notification or another mod's prompt that opens on a command's name runs nothing. A prompt of the user's that ends on a line naming {{names.trailing}} alone, as the pane's {{command.reassess.label}} button leaves its draft, runs it too, with or without answers before it: take any answers first, then run it with them settled. {{names.not-trailing}} never trails. The `{{plugin}}@<marketplace>:` line a draft from the pane opens with is neither an answer nor a note.

Both {{command.open.name}} and {{command.reassess.name}} leave out an item a later turn settled or made moot, a {{lists.todo.header}} item as much as a {{lists.decide.header}} one, and an {{lists.authorizations.header}} item once granted or withdrawn, and print into the {{list.authorizations}}, {{list.review}}, {{list.todo}} and {{list.decide}} lists, never {{list.answers}}.

**{{command.open.name}}: the open items as they were written.** The items are reprinted with their wording and options unchanged, so the user can answer the items they were already shown; a {{lists.todo.header}} item keeps its path and what it frees. Each names the turn and item it came from, `(from {{example.turn}} 2.C)`. The earlier turns stay open, rolled up as before. Grouping only moves the items under their topics and renumbers them. A {{lists.decide.header}} item an older reply wrote with {{untaught.options}} options is reprinted with them as {{options.kinds.radio.glyph}} {{letters.pair}}, in their order, its source naming the letter it was printed with.

**{{command.reassess.name}}: the open items, worked out afresh.** It reads the same items and the work's state now: what has landed, what is running, what has been learnt since. The earlier items are evidence of what is undecided, not a structure to keep, so the {{command.reassess.word}} takes no item's wording, grouping, numbering or options as given:

- **Merged:** items that are one decision become one item, such as a sending date raised in one turn and what the send waits for raised in another.
- **Split:** an item that holds 2 decisions becomes 2 items.
- **Dropped:** an item that the state of the work has settled or made moot is left out.
- **Changed:** an option whose cost or gain has changed since is rewritten with today's figures.
- **Added:** a decision the work's state now needs, and that no earlier item asked, is raised.
- **Reordered:** within its topic's list, the decision that gates the most work is printed first.

Each {{lists.decide.header}} item follows the rules for a {{lists.decide.header}} item; each {{lists.todo.header}} item still open stays an action of the user's with its path and what it frees, merged only where 2 ask the same action. The lists of a turn that runs {{command.reassess.name}} replace every earlier turn it read: the turn prints no {{roll-up.glyph}} roll-up, and the next roll-up holds that turn's items and later ones alone.

**`Expand`: one item at the depth its list needs.** An expanded item, or option, holds what the user needs to act on it without reading anything else, and is printed in its list as new this turn; its expansion is the item's wording from then on. An expanded option expands the same way, under its own item's summary.

| List | An expanded item gives |
| --- | --- |
| {{list.authorizations}} | what the grant is and what asks for it, where to give it, the prompt's window or the exact approval message to send, when it times out, everything it covers as a nested list, and what granting it frees |
| {{list.review}} | what the thing is and why it is up for review, where to open it as a link they can click, what to look for, and what their review frees |
| {{list.todo}} | numbered steps; enough context to find the thing, its name as it appears where they will look for it, a date or a size that tells it from its neighbours; and every link or text they need, in the form its destination takes: a URL to click, a command or a prompt in its own `text` block to copy, a path from the repository root |
| {{list.decide}} | what the thing being decided is and how it came up, the facts each option turns on, with figures from the database or the run, what each option does and costs, which one is recommended and why, and what happens if they do not decide |

**Grouped by topic.** {{command.open.name}} and {{command.reassess.name}} group their lists under topics, each topic one unit of work as the user thinks of it: a repository, a plan, a pull-request stack, a workstream.

- **Topic header:** the topic's name in bold, alone on its line and ending in a hard line break, and under it one `{{characters.topic-underline}}` {{codepoint.topic-underline}} per column of the name. The topic's lists follow straight under it in the lists' order, each with its own header and `{{characters.header-underline}}` underline, a list with no items in the topic left out. A blank line ends a topic's last list, before the next topic's header.
- **Which topics:** sort the items into topics by their content. A topic needs 3 items to stand alone, and the rest go under `Miscellaneous`, always last; there are at most 6 topics. The topic with the most to decide or do comes first. A {{command.reassess.name}} keeps the topic names of the previous {{command.reassess.name}} for the items carried over from it.
- **Numbering:** each list numbers on across topics, so where the first topic's {{lists.decide.header}} list ends at 3 the next topic's starts at 4, and `{{lists.decide.header}}.4` still names one item.

The {{roll-up.glyph}} roll-up and every other final response are not grouped.
