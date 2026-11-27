---
title: What the harness and the trackers report, a finished shell, a subagent's end or a merged pull request, reaches the fold as observations
state: approved
kind: implementation
part-of: items-events-views
needs: [item-event-reducer, task-list-matches-pending]
touches: [plugin/src/transcript/claude-code.ts, plugin/src/items/, plugin/src/pane/pane-state.ts, plugin/hooks/register.tsx, plugin/spec/kanban.yaml, plugin/cli/neutral.ts, plugin/types/index.d.ts, plugin/test/unit/, plugin/test/engine/]
---

# What the harness and the trackers report, a finished shell, a subagent's end or a merged pull request, reaches the fold as observations

The agent's tool call and the person's answers are 2 of the 3 event sources.
The third is what the harness and the trackers report, and without it an item owned by something external, or a review of a pull request, can never close deterministically.

- **An item links, and never copies.**
  An item names a harness entity or an artefact in a `blocked-by` or an `about` link, and holds none of its state.
  The target's status is read live and drawn in the item's status clause.
- **The link targets are typed in the spec.**
  Each target type has a form, such as `shell:<id>`, `agent:<id>` or `github:<owner>/<repo>#<n>`, its statuses, and its watch rule: which status closes the item, and with what outcome.

  | Target                          | Statuses                                              | Watch rule                                               |
  | ------------------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
  | A background shell, a workflow  | running; completed, failed, killed                    | `completed` unblocks; `failed` or `killed` unblocks, and says so |
  | A subagent or a teammate        | pending, running, waiting, idle; completed, failed, killed | The same                                            |
  | A monitor, a scheduled wakeup   | running or scheduled; expired, fired, stopped         | `fired` or `expired` unblocks                            |
  | A pull request                  | open; merged, closed                                  | `merged` resolves a review as `done`; `closed` as `dropped` |
  | A CI run                        | running; passed, failed                               | `passed` unblocks; `failed` unblocks, and says so        |

  A target type added to the spec is watched with no code changed, where its status comes from a source the adapter or the poll already reads.
- **What the transcript holds becomes events.**
  The Claude Code adapter reads, into a turn's `events`, each as an `observe` by `external:<source>` with the record as its evidence:
  - a task notification for a finished shell, workflow or expired monitor;
  - an agent's or another session's message that reports on a subagent or a branch an item links to;
  - a `TaskCreate` or a `TaskUpdate` call, as evidence alone, which raises, closes and unblocks no item and is no link target, since the agent raises its own tasks through [the tool](item-tool-declares-events.md), as [task-list-matches-pending](../../../reports/2026-11-27-task-list-matches-pending.md) found;
  - an `AskUserQuestion` call and its answer, as a question raised and resolved in one, so the history is whole (open question 11 in [the end state](items-events-views.md)).

  The fold turns an `observe` into a `resolve` or an unblocking by the target's watch rule, with no code for any one target.
- **What the transcript doesn't hold is read live.**
  A pull request's state and a CI run's are asked of `gh` at a refresh, within `counts.gh-timeout-ms`, and a running shell's or agent's of the engine.
  They're a second input to the fold, the statuses by target, and are kept in no log (open question 4): a tracker's closed status never reopens, so the same transcript folds to the same items once the status is known.
  A status that can't be read closes nothing and reopens nothing, and the pane says why.
- **Nothing the harness draws is drawn again.**
  A permission prompt, a plan awaiting approval and a picker are the harness's own, and get no item while they're up.
  A shell, an agent or a pull request gets no row of its own: it shows as the status clause of the item that links to it.
- **An external item needs a watch.**
  An item owned by `external` has a link whose target has a watch rule, or [the tool](item-tool-declares-events.md) refuses it.
- **Stale.**
  An item owned by `external` whose watch has reported nothing for longer than a setting allows is `stale`, a derived field the status clause says.
- **Only the person's text answers.**
  An observation never answers a question and never runs a command: a peer's report is an `observe`, whatever it says.

**Refactored as it goes:** the one `gh` call's arguments and the read of its answer leave `plugin/src/items/outstanding.ts`, where they sit among the settlers, for the artefacts layer, as the link target `github`'s status reader; the harness's statuses, a shell's or an agent's, get a reader each in the harness layer, behind the same shape.

Checks:

- unit tests for the adapter, one per record kind, each giving the `observe` it should and no event of the person's;
- unit tests for the fold with the statuses as its second input: a merged pull request closes its review as `done`, a closed one as `dropped`, a finished shell unblocks the item it blocked, and an unreadable status changes nothing;
- a property test that folding a log with the statuses known gives the same items whatever order the statuses arrived in;
- a target type added to the fixture spec, with a watch rule, closes its item with no code changed;
- engine tests in `plugin/test/engine/` that a `gh` answer closes a review in the pane and the count line, and that a `gh` that fails closes nothing and is said.
