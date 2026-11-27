---
state: current
as-of: d0ac3d6
---

# Whether the harness's task list matches the agent's Pending items

This is the check [task-list-matches-pending](../plans/items-events-views/closed/task-list-matches-pending.md) specifies, for open question 5 of [the end state](../plans/items-events-views/open/items-events-views.md).
It changed no code.

## The finding

The task list never held one of the agent's Pending items.
No session of this repository, or of any other on this machine, calls `TaskCreate` or `TaskUpdate`, so at every turn's end the task list is empty while the Pending lists and the 📌 roll-up name the agent's commitments.
Where the harness offered the task tools, as deferred tools a `ToolSearch` would load, and reminded the model to use them, the model never loaded them and never called them.

The recommendation is to **raise through the tool**: the agent declares its own turn-level tasks through the item tool, and a `TaskCreate` or `TaskUpdate` call is evidence alone.
That reverses the end state's standing recommendation, which projected the task list wherever the model has the task tools.

## The sessions

The node's bar is a session of this repository that calls `TaskCreate`, writes a 🚧 Pending list and runs 10 turns or more.
No session meets it:

- Across the 2,370 transcripts under `~/.claude/projects/`, subagents' included, no assistant record has a `TaskCreate`, `TaskUpdate` or `TodoWrite` tool use.
- This repository and its worktrees have 11 transcripts.
  Ten are headless runs of one prompt, which open no turn as the plugin reads them.
  The eleventh, `bc3ede89`, has 414 turns and writes Pending lists, and its main agent was never offered `TaskCreate`: no deferred-tools listing in it names the tool, and the harness's reminder to use it never appears.

In its place the check reads the 3 sessions closest to the bar, each with 10 turns or more and Pending lists:

- `bc3ede89`, this repository's one session with turns, which is also the session that ran this check, read as it stood;
- `c6eaa3ae` and `f9dafd82`, in two other repositories of the same person, the only main sessions on this machine that were offered `TaskCreate`.

| Session    | Repository | Turns | Answered | Task tools offered                   | Reminders to use them | Task tool calls |
| ---------- | ---------- | ----: | -------: | ------------------------------------ | --------------------: | --------------: |
| `bc3ede89` | this one   |   414 |      402 | no                                   |                     0 |               0 |
| `c6eaa3ae` | another    |   417 |      410 | deferred, through 318 of its turns   |                   125 |               0 |
| `f9dafd82` | another    |    21 |       20 | deferred, through 19 of its turns    |                    13 |               0 |

"Reminders" counts the `task_reminder` attachments, the harness's reminder to consider `TaskCreate`; the copies of them in API request records aren't counted.
A deferred tool is named to the model but not loaded: the model loads it with a `ToolSearch` before it can call it.
In `c6eaa3ae` the model's one `ToolSearch` that named a task tool loaded `TaskStop`, to stop a background shell.

## How it was counted

- **Turns** are the plugin's own: `turnsOfText` in `plugin/src/transcript/claude-code.ts`, at d0ac3d6, over each transcript, and only the turns with a final response are compared.
- **Pending items** are read from each final response by the plugin's reply parser, `itemsOfText` in `plugin/src/items/outstanding.ts`:
  - the turn's own items are the numbered items of its 🚧 Pending list;
  - the roll-up's items are the 🚧 items of a full 📌 roll-up, or, where the roll-up was the count line, the 🚧 number the count line gives.
- **The task list** at a turn's end is what the `TaskCreate` and `TaskUpdate` calls up to there leave open.
  With no such call, it is empty at every turn.
- **The matching** by hand had nothing to weigh: against an empty task list, every Pending item is matched to no task, and no task is left unnamed.

The counting ran inline from the node's worktree, and no script was kept.
The report gives counts and session ids only, since the transcripts hold the person's own text.

## The counts

Each turn's three counts are summed over its session.
A roll-up item is counted once in each turn whose roll-up names it, so the roll-up's column counts an item once per turn it stays open.

| Session    | Turns with a 🚧 list | 🚧 items in the turn's list | 🚧 items in the roll-up | Pending items with a task | Pending items with none | Open tasks no Pending item names |
| ---------- | -------------------: | --------------------------: | ----------------------: | ------------------------: | ----------------------: | -------------------------------: |
| `bc3ede89` |                   33 |                          58 |                   1,163 |                         0 |                   1,221 |                                0 |
| `c6eaa3ae` |                   53 |                         263 |                   3,090 |                         0 |                   3,353 |                                0 |
| `f9dafd82` |                    2 |                           5 |                      30 |                         0 |                      35 |                                0 |
| Total      |                   88 |                         326 |                   4,283 |                         0 |                   4,609 |                                0 |

Of the roll-up's items, 13 were printed in a full roll-up (11 in `bc3ede89`, 2 in `f9dafd82`) and the rest counted from count lines.

## Which way they differ

They differ one way only: commitments the task list never held.
No task is smaller than a turn's commitment, or larger, since there is no task.

The empty task list is what the agent does under the instructions it runs with.
The kanban skill and the plugin's instructions name the 🚧 Pending list as where the agent's own work goes and never name the task list.
In the two sessions that were offered the task tools, 138 reminders from the harness didn't change that: the model never loaded the tools.
A projection of the task list would have shown the person none of the 326 items the agent put in its own Pending lists.

## The recommendation

**Raise through the tool.**
It rests on what the agent did, not on the node's rule, whose bar no session met:

- The agent never used the task tools, in 832 answered turns, even where the harness offered them and reminded it 138 times, while it wrote 326 items into its own Pending lists.
- A projection of the task list would show the agent's tasks only if the agent changed how it works; the item tool is the plugin's own, so the plugin's instructions teach it, whatever tools the harness offers.

So:

- The agent declares its own turn-level tasks through the item tool, whether or not the harness offers the task tools.
- A `TaskCreate` or `TaskUpdate` call, where one appears, reaches the fold as an observation, evidence alone, which raises, closes and unblocks no item.

It reverses open question 5's standing recommendation, which projected the task list where the model has the task tools and fell back to the tool only where it doesn't.

## Limits

- Three sessions, two of them in other repositories, stand in for the node's bar, which no session meets.
- The two sessions offered the task tools were offered them only as deferred tools, which take a `ToolSearch` to load; neither had them loaded from the start, so how an agent with them loaded would use them is untested.
- No session ever filled the task list, so the comparison the node describes, of open tasks against Pending items, ran against an empty list each time.
  An agent told to keep the task list might fill it, but that agent writes each task once either way, and the item tool carries what the task list doesn't: the kind, the person as an owner, links to artefacts such as a pull request, and the person's answers.
