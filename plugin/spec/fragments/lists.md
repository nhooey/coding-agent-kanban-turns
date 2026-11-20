## The final response's lists

The final response's lists, in the order it prints them: {{names.lists}}.

| Header, written exactly so | Holds, from this turn only | Waits on |
| --- | --- | --- |
| {{header.done}} | one item per change, with its file and commit; a clean check, with what it checked and the count | nobody |
| {{header.pending}} | the agent's own work started and not finished, scope left out, a hold that will not announce itself when it lifts | the agent |
| {{header.logged}} | one item per entry written into the project's backlog, by index and title | the next agent |
| {{header.waiting}} | a background shell, subagent, hand-off or expected message, and what the session does with its result | the thing itself |
| {{header.answers}} | one item per question the user asked that names no listed item, the question as the summary, shortened or reworded where that reads better, the answer under it | nobody |
| {{header.authorizations}} | one item per grant only the user can give: a 1Password, SecretSpec or SSH signing prompt, an approval for actions the harness or a classifier refused, a `sudo` password | the user |
| {{header.review}} | one item per thing put in front of the user to read, listen to or look at, a pull request to review or merge among them, with where to open it and what to look for | the user |
| {{header.todo}} | one item per action asked of the user that is not a choice, reading or grant: a file to mark up, a prompt to paste, a command to run; each says what to do, where, by its path, and what it frees | the user |
| {{header.decide}} | one item per decision raised, and per judgement call taken instead of asked, its reversal an option | the user |

The {{names.rolled-up}} lists' items roll up into {{roll-up.glyph}} until something settles them: an {{lists.authorizations.header}} item until it is granted or withdrawn, and a {{lists.review.header}} item until the user's reply shows they reviewed it. The {{names.not-rolled-up}} lists' items never roll up.

An empty list is left out, and the final response opens on a line of prose. An answer takes the shape its information has: a comparison is a table, a sequence is numbered steps, parallel items are a list. A table never goes inside an item, where it prints as raw pipe rows: it goes after its list's last line and blank line, under a line naming the item, such as `{{lists.answers.header}}.3:`, then a blank line, the table, and a blank line before the next list's header. A table always has a blank line above and below it, since a line directly under its last row is drawn as one more row.

**A list holds only what is new this turn.** An item an earlier turn printed, unchanged since, is not printed in its list again; it rolls up into {{roll-up.glyph}}. An item whose state changed this turn, a {{lists.waiting.header}} agent that reported, a {{lists.todo.header}} item whose prompt is now ready or an item whose question was answered, is new again and is printed in its list with the change.

**Which list.** A review that is itself a choice goes in {{list.decide}}, a task that is not a reading goes in {{list.todo}}, and a grant only the user can give goes in {{list.authorizations}}.

**An authorization is a grant, not a task or a choice.** A {{list.todo}} item asks the user to do something, a command to run or a file to mark up, and a {{list.decide}} item asks them to choose. A {{list.authorizations}} item asks for what only the user can give, a password, a touch or an approval, often against a prompt that times out, and the work behind it stops until they give it. A `sudo` command or a system switch the user runs for their password is an authorization, since what it waits on is the password, and the command goes on a line of its own after `💻 ❯`. The summary leads with what the grant unblocks, the tag, branch, token or command, never only the kind of prompt, so two grants of one kind stay two items in the {{roll-up.glyph}} roll-up. Each item says where to grant it, the prompt's window or the approval message to send, how long the prompt stays open and what granting it frees, and lists what it covers, such as the pull requests or commands one grant covers, as a nested list under its summary; the prompt's state goes in the item's body, never its summary, which the roll-up reprints. The {{lists.authorizations.header}} list leads the lists that wait on the user, since what it holds blocks running agents.

**A pull request is a {{lists.review.header}} item.** A pull request the user is asked to review or merge goes in {{list.review}}, by its canonical label, its number and title, linked, with what to check in it. When this turn's work opened it, the {{list.done}} item for that work names the change in a line and points at the {{lists.review.header}} item by reference, `see {{lists.review.header}}.1`, without repeating the pull request's label, link or contents, so the pull request is described once.

**A turn reply is a delta.** Each {{list.done}} item states the state reached, such as "`retries`: 3 → 5 in `config.toml`", never the actions taken to reach it.

**An item that reports on many things is grouped and layered.** The result of a run over many repositories, files or checks opens on its totals and names what needs action, then gives the groups with their counts, the groups that need the user first. A group that needs nothing from the user is its count and the file or command that lists it, and its items are printed when the user asks for them.
