---
state: current
as-of: 81cf047
---

# The 9 lists against the filter table, labelled by hand

The check of [lists-fit-filter-table](../plans/items-events-views/closed/lists-fit-filter-table.md): every list item of every golden case in `plugin/spec/cases/` and of the fixtures' transcripts in `plugin/test/fixtures/`, labelled by hand with its kind, owner and state, against the filter table in that node.
One live session of this repository was read for more items, which are counted below by turn and quoted nowhere.

## The finding

No item contradicts the model.
Every item's kind, owner and state are fields the item shape in [items-events-views](../plans/items-events-views/open/items-events-views.md) already has, and no list needs a field the shape lacks.

- Of the 137 golden items, 114 fit their list's row and 23 don't, in 5 classes, M1 to M5; of the 5 fixture items, all fit.
- Of the 1,110 live items, 1,005 fit, 52 don't, 2 fit another list's row, and 51 weren't checked; the 52 fall in 6 classes, M6 and M7 among them, which no golden case shows.
- Four classes show the table's rows are narrower than the lists' use: Done holds every item closed in the turn, whatever its kind and owner (M1, M2, M6), and Answers holds answers to questions no prompt of that turn asked (M3).
  The model answers both with what it already has: the turn's closed items are a filter on state and `resolution.in`, and an answer is prose.
- One class is prose the model never reads: a reply restating an item that closed in an earlier turn, under Done or 📌 (M5).
- One class needed an edit, made in this commit (M4): the `approval` preset in [item-model-in-spec](../plans/items-events-views/open/item-model-in-spec.md) required `blocks`, a relation its sketch doesn't define.
  An approval now names what it gates in any one of three ways, an `about` link to a typed target, the items it `frees`, or the refused call's text, and no watch rule closes one.
- One live class is a link target the model had no type for (M7): work waited on from a peer session in another repository, whose `blocked` never clears.
  It's now open question 21 in [the end state](../plans/items-events-views/open/items-events-views.md), with a recommendation.

Two results that aren't misfits shape how the rows read:

- **The Waiting row's owner column holds nothing here.**
  No Waiting item is labelled as owned by `external`, but that follows from the labelling rule, which labels a Waiting item as the agent's task blocked by what it names, and not from the data; every Waiting item fits through the row's "or blocked by" clause, or doesn't fit at all (M7).
- **The rows overlap.**
  Waiting items fit Pending too, Review items fit Todo, and Authorizations items fit Decide; the agent's choice of list was all that parted them.
  In the model the derived `blocked` and the presets `review` and `approval` part them, and both are already in the shape.

## The counts

| List              | Golden items | Fit | Fixture items | Fit | Live items | Fit   | Live misfits | Another row | Unchecked |
| ----------------- | ------------ | --- | ------------- | --- | ---------- | ----- | ------------ | ----------- | --------- |
| ✅ Done           | 33           | 16  | 1             | 1   | 221        | 209   | 12           | 0           | 0         |
| 🚧 Pending        | 18           | 18  | 0             | 0   | 84         | 84    | 0            | 0           | 0         |
| 📝 Logged         | 2            | 2   | 0             | 0   | 0          | 0     | 0            | 0           | 0         |
| ⏳ Waiting        | 7            | 7   | 0             | 0   | 322        | 294   | 28           | 0           | 0         |
| ❓ Answers        | 3            | 1   | 0             | 0   | 49         | 30    | 6            | 0           | 13        |
| 🔑 Authorizations | 2            | 0   | 0             | 0   | 6          | 0     | 6            | 0           | 0         |
| 🔍 Review         | 8            | 8   | 1             | 1   | 116        | 116   | 0            | 0           | 0         |
| 👉 Todo           | 23           | 23  | 0             | 0   | 104        | 102   | 0            | 2           | 0         |
| 🧠 Decide         | 30           | 30  | 3             | 3   | 170        | 170   | 0            | 0           | 0         |
| 📌 roll-up        | 11           | 9   | 0             | 0   | 38         | 0     | 0            | 0           | 38        |
| Total             | 137          | 114 | 5             | 5   | 1,110      | 1,005 | 52           | 2           | 51        |

Each item is counted where a reply prints it, so an item restated by a `reassess`, reprinted by `open` or pinned under 📌 counts once per printing; in the model each is one item drawn again.
The Authorizations items are misfits against the preset as the sketch had it, all 8 of them, and the M4 edit is their answer.

## The misfits and their answers

| #   | Misfit                                                                                       | Where                                                                                                                                                                                                                                                                                                                                                   | What it lacks                                                                                                                                                                                                                                                | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | A Done item states the answer to a question the person answered this turn, and no work       | 5 golden: decide-answer-forms `18e77cb3.Done.1` to `.4`, reassess-after-answers `3b5d7f91.Done.1`; 5 live, in turns `d7c90a91` and `2f0c3851`                                                                                                                                                                                                          | The Done row's kind and owner: the item is a question the user owned, closed `answered`                                                                                                                                                                     | None needed. The item is the question itself, closed by the user in this turn, and no second item; the turn's closed items are a filter on `state: closed` and `resolution.in`, whatever the kind and owner, as the end state's "What changes for the person" table already says of Done.                                                                                                                                                                                                                          |
| M2  | A Done item records a review the person owned, closed by its pull request's merge            | 1 golden: review-settled-by-merge `6f80ab24.Done.1`; 3 live, in turns `0c7324f6`, `7beb4637` and `30380518`                                                                                                                                                                                                                                            | The Done row's owner: the item is the user's review, resolved `done` by an observer                                                                                                                                                                         | None needed, as M1: the review closes by the pull request's watch rule, and the turn's closed items include it.                                                                                                                                                                                                                                                                                                                                                                                                       |
| M3  | An Answers item answers a question no prompt of its turn asked                               | 2 golden: every-list `1c2d3e4f.Answers.1`, older-list-names `1f2e3d4c.Answers.1`; 6 live, in turns `275f27d2` and `4a2206b0`, whose prompt is a message and not the person's, and `2a856a6a` and `a4b40c4e`                                                                                                                                           | The Answers row's condition, raised by the person in this turn's prompt                                                                                                                                                                                     | None needed. In the model an answer to the person is prose, and a question the agent can't answer in its turn is a task it owns, linked to the prompt, which a later turn closes; an explanation the agent volunteers is prose too.                                                                                                                                                                                                                                                                                |
| M4  | An Authorizations item gates an action, and the `approval` preset's link for it is undefined | 2 golden: every-list `1c2d3e4f.Authorizations.1`, frees-on-several-lists `a1b2c3d4.Authorizations.1`; 6 live force-pushes, in turns `7f87cce3`, `f9837498`, `8b30210f`, `cda36726`, `99cb9f62` and `620527c1`                                                                                                                                         | The preset required `blocks`, which the sketch's relations don't define: the stored relation is `blocked-by` on the waiting item, drawn as `frees` on its blocker. Nor is a token prompt or a branch a target type that `about` could name                    | [item-model-in-spec](../plans/items-events-views/open/item-model-in-spec.md)'s `approval` preset now requires any one of `about`, `frees` and `refused`. every-list's approval is `about` the pull requests #12 and #13, typed `github:` targets; frees-on-several-lists' carries `frees` for `Waiting.1` and `Todo.1`; a live force-push carries the refused call's text, where the harness refused it, or frees the agent's push task. No watch rule closes an approval: a pull request it's `about` shows in its status clause, and the pull request's rule resolves only a review. |
| M5  | A reply restates an item that closed in an earlier turn                                      | 13 golden: lint-list-findings' 9 Done items after `c0d1e2f3`, lint-layout-findings `f9a0b1c2.Done.1` and `2c3d4e5f.Done.1`, roll-up-restatement-reopens-nothing `5e6f7081` 📌 1 and `6f708192` 📌 1                                                                                                                                                   | The Done row's "closed in this turn", or the roll-up row's open state                                                                                                                                                                                       | None needed. An item is drawn from the fold, once, with its state, so a reply's prose restating it raises and closes nothing; a restated Done item is the earlier resolution, and the roll-up is the count line, computed.                                                                                                                                                                                                                                                                                         |
| M6  | A Done item records a peer's work, or a question between the agent and a peer, closing       | 4 live, in turns `7fc3d037`, `fab20daf`, `b4bf4ae6` and `5d890568`                                                                                                                                                                                                                                                                                     | The Done row's owner or raiser: a peer, never the agent's own task                                                                                                                                                                                          | None needed, as M1: `raised-by` and `owner` hold any actor, and the turn's closed items include them. The one in `fab20daf` isn't closed yet, and is the peer's open task.                                                                                                                                                                                                                                                                                                                                         |
| M7  | A Waiting item waits on a peer session in another repository                                 | 28 live, in turns `025deafe`, `046e3767`, `05471240`, `0e88d0c8`, `15f1b049`, `1b9125dd`, `2f94cff0`, `33c22721`, `3461f956`, `43f18fad`, `5ce1dc64`, `610a6670`, `65621a24`, `7b50aca6`, `84036855`, `9f180849`, `9febe7c8`, `b2c3386d`, `bc4ffb4e`, `c7779ea3`, `e21308de`, `e6460f9a`, `e69da5a1`, `e8a2d3c6`, `e8fc0a9f` and `fef3f95b`      | A link target: `blocked-by` takes an item, an entity or an artefact, and an `agent:<id>` target is a subagent or teammate whose status the engine reads; a peer is neither, has no target type and no status source, so the item's `blocked` never clears | Open question 21 in [the end state](../plans/items-events-views/open/items-events-views.md) recommends a `session:<id>` target type in [harness-observations-as-events](../plans/items-events-views/open/harness-observations-as-events.md) with no status source: each message from the peer is an `observe` that changes nothing, and the agent, reading it, removes the link or resolves the item. 7 live Pending items wait on a peer too; they fit Pending's row, which asks nothing of a block, and share the gap. |

## What fits, with a note

- **A review that names no artefact.**
  frees-to-unknown-items `c3d4e5f6.Review.1`, "The docs rewrite", names its pull request only on a `Frees:` line, which the case reads as no part of its text.
  It fits through a field the shape has: the `review` preset requires `about`, so the tool refuses it until the agent names the pull request, or the agent raises it as a plain task.
- **A bare `#14` or `#23` in a Review summary.**
  The `about` link names the repository the reply leaves out, and a bare `#12` in the model's prose is an item reference, which the end state's open question 2 answers by having the agent name a pull request with its repository or a link.
- **Body text the rows never read.**
  A deadline ("It expires on Friday"), an expiry ("The prompt stays open for 10 minutes") and a reason are the item's `body`; the expiry is the linked entity's state, which an item never copies.
- **Live items under the list next door.**
  2 live Todo items stand for a question, not a task: one asks the person to confirm a cause, in turn `16b0bf56`, and fits Decide's row, and one asks leave to rebuild branches as a stack, in turn `ff292a9c`, and fits Authorizations'.
  The other 20 Todo items that ask the person to approve or unlock something are tasks the person does elsewhere, such as unlocking an SSH agent or approving a prompt in another session, and fit Todo's row.
- **An investigation written as a task.**
  4 live Pending items, in turns `434f6398`, `4a2206b0`, `610a6670` and `9f180849`, are the person's question that the agent couldn't answer in its turn, which the model makes a task the agent owns, linked to the prompt, so each fits Pending.
- **A response written on the way.**
  The fixture `UNANSWERED` turn in `plugin/test/fixtures/cli.ts` prints a Done item mid-turn; it fits the row, and in the model a response's words are prose, so it raises nothing.

## The live session

One session of this repository, read on 2026-11-27: 361 final responses with lists, 1,110 list items.
The items were sorted by category from their summaries and labelled by what each stands for, with the misfits and the items under another list's row read one by one; a turn here is the first 8 characters of the prompt's id, as the references use.

| List           | Items | What they hold                                                                                                                                                                                                                                  |
| -------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Done           | 221   | 209 the agent's own work, closed in the turn; 5 an answer stated as done (M1); 3 a pull request merged (M2); 4 a peer's work or question (M6). None repeats an earlier Done item word for word; restatements in other words weren't checked |
| Pending        | 84    | The agent's tasks, 4 of them investigations; 7 wait on a peer session                                                                                                                                                                         |
| Waiting        | 322   | 291 a subagent's work, 2 a monitor, 1 a schedule on pull requests' reviews; 28 a peer session (M7)                                                                                                                                             |
| Answers        | 49    | 30 answer a question the turn's own prompt asks; 6 don't (M3); 13 sit in a turn whose prompt asks no matching question but whose bounds a subagent's report or a skill load blurs, so they're unchecked                                     |
| Authorizations | 6     | Each a force-push, naming its branch (M4)                                                                                                                                                                                                       |
| Review         | 116   | 99 a pull request; 17 a plan file or a subagent's handling of a blocked command, an `about` to an artefact or an entity                                                                                                                        |
| Todo           | 104   | 102 the person's tasks; 2 questions under Todo                                                                                                                                                                                                  |
| Decide         | 170   | Questions with options, 64 of them yes or no                                                                                                                                                                                                    |
| 📌 roll-up     | 38    | Restatements of earlier turns' items, not checked against later turns for their state, so unchecked                                                                                                                                           |

## How the items were labelled

- **Kind** is `task` or `question`; **owner** is `user`, `agent` (the main loop), `agent:<id>` or `external:<name>`; **state** is `open`, `active` or `closed`.
- An item is labelled by what it stands for, not by the list it's printed in: a Done item that states an answered Decide item is labelled as that question.
- A Waiting item is the agent's own task, `active`, `blocked-by` the shell, monitor or subagent it names, since in the model a harness entity gets no row of its own.
- A 📌 bullet, a reprint by `open` and a restatement by `reassess` are labelled as the item they restate, in the state that item has at their turn.
- **M1 or a fit.**
  A Done item after an answer fits when it names work the agent did on the answer, a version set, a cache removed, entries cleaned up: it's the agent's task, closed `done`.
  It's M1 when it only states the answer, a merge order, a retention period, files kept, so the item it stands for is the question.
  So decide-numbered-answers' and decide-answered-by-reference's Done items fit, and decide-answer-forms' are M1.
- **M6 or a fit.**
  A Done item about a subagent's or a peer's work fits when it closes a task the agent held, such as waiting-settled-by-report `9cb3de57.Done.1`, the agent's `7a91bc35.Waiting.2` closing once the subagent's report unblocks it.
  It's M6 when what closes is the peer's own, its merge, its message or its question, which the agent never held as a task.
- `plugin/test/fixtures/replies.ts` isn't labelled: it draws random replies that put any of 4 summaries under any list's header, so no item in it belongs to a list, and nothing it prints tests the table.
- The other fixtures with items are `submit.ts`'s 2 Decide items, `refresh.ts`'s transcripts, which add a Review item and a drawn Decide item, and `cli.ts`'s unanswered turn.

## The labels

"—" is a row with no condition beyond its kind, owner and state.

### every-list

| Item                        | Summary                               | Kind     | Owner | State  | Condition                            | Fit  |
| --------------------------- | ------------------------------------- | -------- | ----- | ------ | ------------------------------------ | ---- |
| `1c2d3e4f.Done.1`           | Tokenizer fix in commit `a1b2c3d`     | task     | agent | closed | this turn, `done`                    | fits |
| `1c2d3e4f.Done.2`           | Test suite rerun after the fix        | task     | agent | closed | this turn, `done`                    | fits |
| `1c2d3e4f.Pending.1`        | Rework the loader                     | task     | agent | active | —                                    | fits |
| `1c2d3e4f.Logged.1`         | The flaky watcher test, as entry 1502 | task     | agent | closed | `transferred`, link to entry 1502    | fits |
| `1c2d3e4f.Waiting.1`        | The test run (`b8a83gfv0`)            | task     | agent | active | blocked by `shell:b8a83gfv0`         | fits |
| `1c2d3e4f.Answers.1`        | Why the build took 9 minutes          | question | agent | closed | the prompt doesn't ask it            | M3   |
| `1c2d3e4f.Authorizations.1` | 1Password prompt for the merge token  | question | user  | open   | yes or no; gates merging #12 and #13 | M4   |
| `1c2d3e4f.Review.1`         | #14 The README                        | task     | user  | open   | `about` pull request #14             | fits |
| `1c2d3e4f.Todo.1`           | Rotate the `deploy-bot` key           | task     | user  | open   | —                                    | fits |
| `1c2d3e4f.Decide.1`         | Ship the release tonight?             | question | user  | open   | —                                    | fits |
| `2d3e4f50` 📌 1             | Rework the loader                     | task     | agent | active | raised in `1c2d3e4f`                 | fits |
| `2d3e4f50` 📌 2             | The test run (`b8a83gfv0`)            | task     | agent | active | raised in `1c2d3e4f`                 | fits |
| `2d3e4f50` 📌 3             | 1Password prompt for the merge token  | question | user  | open   | raised in `1c2d3e4f`                 | fits |
| `2d3e4f50` 📌 4             | #14 The README                        | task     | user  | open   | raised in `1c2d3e4f`                 | fits |
| `2d3e4f50` 📌 5             | Rotate the `deploy-bot` key           | task     | user  | open   | raised in `1c2d3e4f`                 | fits |
| `2d3e4f50` 📌 6             | Ship the release tonight?             | question | user  | open   | raised in `1c2d3e4f`                 | fits |

### commands-by-every-name

| Item                                                                                                                                                     | Summary                                        | Kind     | Owner | State  | Condition | Fit  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------- | ----- | ------ | --------- | ---- |
| `6d0f1154.Pending.1`                                                                                                                                     | Rework the loader                              | task     | agent | active | —         | fits |
| `6d0f1154.Decide.1`                                                                                                                                      | Which cache to keep for the loader             | question | user  | open   | —         | fits |
| `7e1a2265.Pending.1`, `8f2b3376.Pending.1`, `9a3c4487.Pending.1`, `a03c4490.Pending.1`, `ab4d5598.Pending.1`, `bc5e66a9.Pending.1`, `cd6f77ba.Pending.1` | Rework the loader, restated by each `reassess` | task     | agent | active | —         | fits |
| `cd6f77ba.Decide.1`                                                                                                                                      | Snapshot retention for the store               | question | user  | open   | —         | fits |
| `de7088cb.Decide.1`, `ef8199dc.Decide.1`, `f0920aed.Decide.1`, `f1a2b3c4.Decide.1`                                                                       | Snapshot retention, reprinted by each `open`   | question | user  | open   | —         | fits |

### count-line-window

| Item                 | Summary                     | Kind | Owner | State  | Condition | Fit  |
| -------------------- | --------------------------- | ---- | ----- | ------ | --------- | ---- |
| `a0b1c2d3.Pending.1` | Rework the loader           | task | agent | active | —         | fits |
| `b1c2d3e4.Pending.1` | Prune the store's snapshots | task | agent | active | —         | fits |

### decide-answer-forms

| Item                                                                    | Summary                                                                | Kind     | Owner | State  | Condition                             | Fit  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- | -------- | ----- | ------ | ------------------------------------- | ---- |
| `0f311c94.Decide.1`, `.Decide.2`, `.Decide.3`, `.Decide.4`, `.Decide.5` | Merge order; snapshot retention; release notes; lock bump; test runner | question | user  | open   | —                                     | fits |
| `18e77cb3.Done.1`                                                       | The pane's branch merges first                                         | question | user  | closed | `0f311c94.Decide.1` answered B        | M1   |
| `18e77cb3.Done.2`                                                       | The store keeps a week of snapshots                                    | question | user  | closed | `0f311c94.Decide.2` answered A        | M1   |
| `18e77cb3.Done.3`                                                       | Both release-notes files stay                                          | question | user  | closed | `0f311c94.Decide.3` answered in words | M1   |
| `18e77cb3.Done.4`                                                       | The lock bump waits for the release                                    | question | user  | closed | `0f311c94.Decide.4` answered B        | M1   |

### decide-answered-by-reference

| Item                | Summary                              | Kind     | Owner | State  | Condition                               | Fit  |
| ------------------- | ------------------------------------ | -------- | ----- | ------ | --------------------------------------- | ---- |
| `9efb08a1.Decide.1` | Which cache to keep for the loader   | question | user  | open   | —                                       | fits |
| `9efb08a1.Decide.2` | Backlog cleanups to start, any of 3  | question | user  | open   | —                                       | fits |
| `9efb08a1.Decide.3` | Ship the release tonight?            | question | user  | open   | —                                       | fits |
| `b2c3d4e5.Done.1`   | The loader keeps only the disk cache | task     | agent | closed | this turn, `done`: the work A asked for | fits |
| `b2c3d4e5.Done.2`   | Entries 1411 and 0712, cleaned up    | task     | agent | closed | this turn, `done`                       | fits |

### decide-numbered-answers

| Item                                          | Summary                                         | Kind     | Owner | State  | Condition         | Fit  |
| --------------------------------------------- | ----------------------------------------------- | -------- | ----- | ------ | ----------------- | ---- |
| `3a7c9e21.Decide.1`, `.Decide.2`, `.Decide.3` | Version number; who signs the tag; announcement | question | user  | open   | —                 | fits |
| `4b8daf32.Done.1`                             | The release's version, set to 2.4.0             | task     | agent | closed | this turn, `done` | fits |
| `4b8daf32.Done.2`                             | The README's top line, announcing 2.4.0         | task     | agent | closed | this turn, `done` | fits |

### frees-across-reassess

| Item              | Summary                       | Kind | Owner | State | Condition | Fit  |
| ----------------- | ----------------------------- | ---- | ----- | ----- | --------- | ---- |
| `e5f6a7b8.Todo.1` | Rotate the `deploy-bot` key   | task | user  | open  | —         | fits |
| `e5f6a7b8.Todo.2` | Merge the retry fix           | task | user  | open  | —         | fits |
| `f6a7b8c9.Todo.1` | Merge the retry fix, restated | task | user  | open  | —         | fits |
| `a7b8c9d0.Todo.1` | Deploy the retry fix          | task | user  | open  | —         | fits |

### frees-on-several-lists

| Item                        | Summary                                          | Kind     | Owner | State  | Condition                                                         | Fit  |
| --------------------------- | ------------------------------------------------ | -------- | ----- | ------ | ----------------------------------------------------------------- | ---- |
| `a1b2c3d4.Pending.1`        | Rework the deploy script's retries               | task     | agent | active | —                                                                 | fits |
| `a1b2c3d4.Waiting.1`        | The staging run (`b7c8d9e0f`)                    | task     | agent | active | blocked by `shell:b7c8d9e0f`, and by Authorizations.1             | fits |
| `a1b2c3d4.Authorizations.1` | 1Password prompt for the `deploy-bot` token      | question | user  | open   | yes or no; gates Waiting.1 and Todo.1, which hold `blocked-by` it | M4   |
| `a1b2c3d4.Review.1`         | o/deploy#21 The retry rework                     | task     | user  | open   | `about` `github:o/deploy#21`                                      | fits |
| `a1b2c3d4.Todo.1`           | Paste the deploy prompt into the release session | task     | user  | open   | —                                                                 | fits |
| `a1b2c3d4.Decide.1`         | Deploy tonight or in the morning?                | question | user  | open   | —                                                                 | fits |
| `b2c3d4e5.Todo.1`           | Restart the staging runner                       | task     | user  | open   | —                                                                 | fits |

### frees-shared-prefix

| Item                | Summary                            | Kind     | Owner | State | Condition                   | Fit  |
| ------------------- | ---------------------------------- | -------- | ----- | ----- | --------------------------- | ---- |
| `abcdef01.Review.1` | o/loader#8 The loader rework       | task     | user  | open  | `about` `github:o/loader#8` | fits |
| `abcdef01.Todo.1`   | Rotate the `loader-bot` key        | task     | user  | open  | —                           | fits |
| `abcdef02.Todo.1`   | Paste the release prompt           | task     | user  | open  | —                           | fits |
| `abcdef02.Decide.1` | Release tonight or in the morning? | question | user  | open  | —                           | fits |
| `1234abcd.Todo.1`   | Announce the release               | task     | user  | open  | —                           | fits |

### frees-to-unknown-items

| Item                                                          | Summary                                                                        | Kind | Owner | State  | Condition                         | Fit  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---- | ----- | ------ | --------------------------------- | ---- |
| `c3d4e5f6.Done.1`                                             | Lock bump in commit `d1e2f3a`                                                  | task | agent | closed | this turn, `done`                 | fits |
| `c3d4e5f6.Review.1`                                           | The docs rewrite                                                               | task | user  | open   | `about` its pull request, unnamed | fits |
| `c3d4e5f6.Todo.1`, `.Todo.2`, `.Todo.3`, `.Todo.4`, `.Todo.5` | Rotate the `ci-bot` key; merge the lock bump; tag; publish the notes; announce | task | user  | open   | —                                 | fits |
| `d4e5f6a7.Todo.1`                                             | Re-run the release check                                                       | task | user  | open   | —                                 | fits |

### lint-layout-findings

| Item                            | Summary                                      | Kind     | Owner | State  | Condition                         | Fit  |
| ------------------------------- | -------------------------------------------- | -------- | ----- | ------ | --------------------------------- | ---- |
| `e8f9a0b1.Done.1`               | Tokenizer fix in commit `a1b2c3d`            | task     | agent | closed | this turn, `done`                 | fits |
| `f9a0b1c2.Done.1`               | Tokenizer fix in commit `a1b2c3d`, restated  | task     | agent | closed | closed in `e8f9a0b1`              | M5   |
| `f9a0b1c2.Logged.1`             | The flaky watcher test, as entry 1502        | task     | agent | closed | `transferred`, link to entry 1502 | fits |
| `0a1b2c3d.Answers.1`            | Why the build took 9 minutes                 | question | agent | closed | the prompt asks it                | fits |
| `2c3d4e5f.Done.1`               | Tokenizer fix, restated under "The loader"   | task     | agent | closed | closed in `e8f9a0b1`              | M5   |
| `2c3d4e5f.Done.2`, printed as 1 | The lock bumped, under the topic "The cache" | task     | agent | closed | this turn, `done`                 | fits |

### lint-list-findings

| Item                                                                                          | Summary                                        | Kind     | Owner | State  | Condition            | Fit  |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------- | ----- | ------ | -------------------- | ---- |
| `c0d1e2f3.Done.1`                                                                             | Test suite rerun after the fix                 | task     | agent | closed | this turn, `done`    | fits |
| `c0d1e2f3.Done.2`                                                                             | Tokenizer fix in commit `a1b2c3d`              | task     | agent | closed | this turn, `done`    | fits |
| `d1e2f3a4.Done.1`, `e2f3a4b5.Done.2`, `f3a4b5c6.Done.2`, `a4b5c6d7.Done.2`                    | Tokenizer fix, restated                        | task     | agent | closed | closed in `c0d1e2f3` | M5   |
| `d1e2f3a4.Done.2`                                                                             | The lock bumped                                | task     | agent | closed | this turn, `done`    | fits |
| `e2f3a4b5.Done.1`, `f3a4b5c6.Done.1`, `a4b5c6d7.Done.1`, `b5c6d7e8.Done.1`, `c6d7e8f9.Done.1` | Test suite rerun, restated                     | task     | agent | closed | closed in `c0d1e2f3` | M5   |
| `d7e8f9a0.Decide.1`                                                                           | Which cache to keep for the loader             | question | user  | open   | —                    | fits |
| `e8f9a0b1.Decide.1`                                                                           | Whether to drop the old cache files, yes or no | question | user  | open   | —                    | fits |

### older-list-names

| Item                 | Summary                                             | Kind     | Owner | State  | Condition                 | Fit  |
| -------------------- | --------------------------------------------------- | -------- | ----- | ------ | ------------------------- | ---- |
| `1f2e3d4c.Pending.1` | Rework the loader, under "Unfinished"               | task     | agent | active | —                         | fits |
| `1f2e3d4c.Answers.1` | Why the build took 9 minutes, under "Questions"     | question | agent | closed | the prompt doesn't ask it | M3   |
| `1f2e3d4c.Review.1`  | #14 The README, under "To review"                   | task     | user  | open   | `about` pull request #14  | fits |
| `1f2e3d4c.Todo.1`    | Rotate the `deploy-bot` key, under "To do"          | task     | user  | open   | —                         | fits |
| `1f2e3d4c.Decide.1`  | Ship the release tonight?, under "Decisions"        | question | user  | open   | —                         | fits |
| `2a3b4c5d.Pending.1` | Prune the store's snapshots, under "Open"           | task     | agent | active | —                         | fits |
| `2a3b4c5d.Decide.1`  | Ship the release tonight?, restated under "Blocked" | question | user  | open   | —                         | fits |
| `2a3b4c5d` 📌 1      | Rework the loader                                   | task     | agent | active | raised in `1f2e3d4c`      | fits |
| `2a3b4c5d` 📌 2      | #14 The README                                      | task     | user  | open   | raised in `1f2e3d4c`      | fits |
| `2a3b4c5d` 📌 3      | Rotate the `deploy-bot` key                         | task     | user  | open   | raised in `1f2e3d4c`      | fits |

### plugin-skill-command

| Item                 | Summary                                     | Kind     | Owner | State  | Condition | Fit  |
| -------------------- | ------------------------------------------- | -------- | ----- | ------ | --------- | ---- |
| `3a4b5c6d.Pending.1` | Rework the loader                           | task     | agent | active | —         | fits |
| `3a4b5c6d.Decide.1`  | Which cache to keep for the loader          | question | user  | open   | —         | fits |
| `4b5c6d7e.Pending.1` | Rework the loader, restated by `reassess`   | task     | agent | active | —         | fits |
| `4b5c6d7e.Decide.1`  | Which cache to keep, restated by `reassess` | question | user  | open   | —         | fits |
| `5c6d7e8f.Decide.1`  | Which cache to keep, reprinted by `open`    | question | user  | open   | —         | fits |

### reassess-after-answers

| Item                 | Summary                                         | Kind     | Owner | State  | Condition                      | Fit  |
| -------------------- | ----------------------------------------------- | -------- | ----- | ------ | ------------------------------ | ---- |
| `2a4c6e80.Pending.1` | Bump the lock                                   | task     | agent | active | —                              | fits |
| `2a4c6e80.Decide.1`  | Who signs the release tag                       | question | user  | open   | —                              | fits |
| `2a4c6e80.Decide.2`  | The release's announcement                      | question | user  | open   | —                              | fits |
| `3b5d7f91.Done.1`    | The release bot signs the tag                   | question | user  | closed | `2a4c6e80.Decide.1` answered A | M1   |
| `3b5d7f91.Pending.1` | Bump the lock, restated                         | task     | agent | active | —                              | fits |
| `3b5d7f91.Decide.1`  | The release's announcement, with a new option B | question | user  | open   | —                              | fits |

### review-settled-by-merge

| Item                | Summary                         | Kind | Owner | State  | Condition                                 | Fit  |
| ------------------- | ------------------------------- | ---- | ----- | ------ | ----------------------------------------- | ---- |
| `5e7f9a13.Review.1` | #21 Close the pane, as a link   | task | user  | open   | `about` `github:example/kanban#21`        | fits |
| `5e7f9a13.Review.2` | example/kanban#22 Bump the lock | task | user  | open   | `about` `github:example/kanban#22`        | fits |
| `5e7f9a13.Review.3` | #23 The README                  | task | user  | open   | `about` pull request #23                  | fits |
| `6f80ab24.Done.1`   | #21 Close the pane, merged      | task | user  | closed | `done` by an observer: `Review.1`'s merge | M2   |

### roll-up-restatement-reopens-nothing

| Item                 | Summary                       | Kind | Owner | State  | Condition                    | Fit  |
| -------------------- | ----------------------------- | ---- | ----- | ------ | ---------------------------- | ---- |
| `3c4d5e6f.Waiting.1` | Watcher on #143 (`b8a83gfv0`) | task | agent | active | blocked by `shell:b8a83gfv0` | fits |
| `3c4d5e6f.Waiting.2` | The nightly build (`n1ght1y`) | task | agent | active | blocked by `shell:n1ght1y`   | fits |
| `4d5e6f70.Done.1`    | Watcher on #143, finished     | task | agent | closed | this turn, `done`            | fits |
| `4d5e6f70.Done.2`    | The nightly build, finished   | task | agent | closed | this turn, `done`            | fits |
| `5e6f7081` 📌 1      | Watcher on #143 (`b8a83gfv0`) | task | agent | closed | closed in `4d5e6f70`         | M5   |
| `6f708192` 📌 1      | The nightly build (`n1ght1y`) | task | agent | closed | closed in `4d5e6f70`         | M5   |

### todo-settling-words

| Item                                    | Summary                                                                    | Kind | Owner | State | Condition | Fit  |
| --------------------------------------- | -------------------------------------------------------------------------- | ---- | ----- | ----- | --------- | ---- |
| `9efb08a1.Todo.1`, `.Todo.2`, `.Todo.3` | Rotate the deploy token; announce the release; check the staging dashboard | task | user  | open  | —         | fits |

### todo-word-note-and-case

| Item                                    | Summary                                                                    | Kind | Owner | State | Condition | Fit  |
| --------------------------------------- | -------------------------------------------------------------------------- | ---- | ----- | ----- | --------- | ---- |
| `9efb08a1.Todo.1`, `.Todo.2`, `.Todo.3` | Rotate the deploy token; announce the release; check the staging dashboard | task | user  | open  | —         | fits |

### waiting-settled-by-report

| Item                 | Summary                                           | Kind | Owner | State  | Condition                             | Fit  |
| -------------------- | ------------------------------------------------- | ---- | ----- | ------ | ------------------------------------- | ---- |
| `7a91bc35.Waiting.1` | Watcher on #143 (`b8a83gfv0`)                     | task | agent | active | blocked by `shell:b8a83gfv0`          | fits |
| `7a91bc35.Waiting.2` | The implementer, on branch `golden-cases-runner`  | task | agent | active | blocked by `agent:a48bb9142825233bb`  | fits |
| `7a91bc35.Waiting.3` | The nightly build (`n1ght1y`)                     | task | agent | active | blocked by `shell:n1ght1y`            | fits |
| `8ba2cd46.Done.1`    | Watcher on #143, finished                         | task | agent | closed | this turn, `done`                     | fits |
| `9cb3de57.Done.1`    | Branch `golden-cases-runner`, pushed at `1234abc` | task | agent | closed | this turn, `done`: `Waiting.2` closes | fits |

### The fixtures

| Item                | Where                                      | Summary                    | Kind     | Owner | State  | Condition                         | Fit  |
| ------------------- | ------------------------------------------ | -------------------------- | -------- | ----- | ------ | --------------------------------- | ---- |
| `9efb08a1.Decide.1` | `submit.ts`, and `refresh.ts`' transcripts | Which cache to keep        | question | user  | open   | —                                 | fits |
| `9efb08a1.Decide.2` | `submit.ts`, and `refresh.ts`' transcripts | Cleanups to start, any     | question | user  | open   | —                                 | fits |
| `9efb08a1.Review.1` | `refresh.ts`' raising turn                 | #21 Close the pane, a link | task     | user  | open   | `about` `github:nhooey/kanban#21` | fits |
| `d4e5f6a7.Decide.1` | `refresh.ts`, drawn and raised by no turn  | Which branch to cut        | question | user  | open   | —                                 | fits |
| `ffffffff.Done.1`   | `cli.ts`, the unanswered turn              | Half written               | task     | agent | closed | this turn, `done`                 | fits |
