---
state: current
as-of: 82aa9a3
---

# The ideal work model for the kanban mod

Design only: nothing in any repository was changed.
It ignores the status quo, as asked, and uses it only as evidence.

The plan built on it is [items-events-views](../plans/items-events-views/open/items-events-views.md), and the plan that clears the code for it is [items-events-views-refactor](../plans/items-events-views-refactor/open/items-events-views-refactor.md).
Sections 1 to 8 are the design as it was written; section 9 holds what the person decided and added after reading it, and governs where the two differ.

Sources read:

- `README.md`, `plugin/spec/kanban.yaml` and `plugin/types/index.d.ts` on master.
- The engine's API types in the `integration` worktree, `plugin/.claude-plugin/types/claude-code/index.d.ts` and `claude-code-tools/index.d.ts`.
- Claude Code's documentation: the [tools reference](https://code.claude.com/docs/en/tools-reference), and the index entries for [hooks](https://code.claude.com/docs/en/hooks), [subagents](https://code.claude.com/docs/en/sub-agents), [agent teams](https://code.claude.com/docs/en/agent-teams), [permissions](https://code.claude.com/docs/en/permissions), [worktrees](https://code.claude.com/docs/en/worktrees), [sessions](https://code.claude.com/docs/en/sessions), [checkpointing](https://code.claude.com/docs/en/checkpointing) and [scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks). Only the tools reference was read in full; the others are cited for their subject, and the entity facts below come from the engine's types.

## 1. The finding in one page

The observation is right, and it can be shown mechanically.
Each of the 9 lists is a filter over 3 independent fields, written down as if it were a type:

| List             | Kind     | Owner    | State           | Extra condition                                   |
| ---------------- | -------- | -------- | --------------- | ------------------------------------------------- |
| ✅ Done          | task     | agent    | closed          | closed in this turn, outcome `done`               |
| 🚧 Pending       | task     | agent    | open or active  |                                                   |
| 📝 Logged        | task     | anyone   | closed          | outcome `transferred`, with a link to a tracker   |
| ⏳ Waiting       | any      | external | open or active  | or blocked by a harness entity                    |
| ❓ Answers       | question | agent    | closed          | raised by the user in this turn's prompt          |
| 🔑 Authorizations | question | user     | open            | yes or no, and it gates an action                 |
| 🔍 Review        | task     | user     | open            | about an artefact, such as a pull request         |
| 👉 Todo          | task     | user     | open            |                                                   |
| 🧠 Decide        | question | user     | open            |                                                   |
| 📌 roll-up       | any      | anyone   | open or active  | raised before this turn                           |

Three things follow from the table:

- **There are 2 kinds, not 9.** Something to do (a task) and something to answer (a question). Everything else is owner, state, or a link.
- **The grid has holes the lists cannot express.** A question the agent owes the user and has not answered yet, a decision the user closed this turn, and a task an external party owns each have no list.
- **Moving an item between lists is an unnamed event.** Todo to Pending is `assign`. Pending to Done is `resolve`. Decide to nothing is `resolve` by the user. Because the list name is inside the item's reference (`0f311c94.Decide.2`), an item that changes owner or kind also changes identity, which is why the moves cannot be followed deterministically.

The recommended model:

- one item type with a kind (task or question), an owner, a state (open, active, closed) and, when closed, a resolution;
- changed only by events from 3 sources (the agent's tool call, the user's answers, and the harness's observations);
- with every list, section, count and roll-up a filter over the fold of those events.

## 2. The ideal model

### 2.1 Four layers

Keeping these apart is most of the design.

| Layer             | What it holds                                                                 | Who owns its truth               |
| ----------------- | ----------------------------------------------------------------------------- | -------------------------------- |
| Harness entities  | Runtime objects: sessions, turns, agents, shells, tool calls, permission prompts | Claude Code                      |
| Artefacts         | Things outside the session: pull requests, issues, CI runs, branches, plan files | GitHub, git, the file system     |
| Items             | Commitments between actors: who owes whom what                                 | The mod's event log              |
| Views             | The reply's digest, the pane, the count line                                   | Nobody: each is computed          |

The rule that separates them: an item never copies the state of a harness entity or an artefact.
It links to it, and the link's target is read live.

### 2.2 The item

```yaml
item:
  id: 12                      # session ordinal, assigned in log order; never encodes kind, owner or state
  kind: question              # task | question
  preset: decision            # optional, data only: decision | approval | review; picks a glyph and defaults
  summary: Which loader to keep
  body: Both are built; this picks the default.
  raised-by: agent:main       # actor
  raised-in: 0f311c94         # turn
  owner: user                 # actor: the one whose move it is
  state: open                 # open | active | closed
  resolution: null            # present exactly when state is closed
  response:                   # questions only: the shape of a valid answer
    picks: one                # one | any | text
    options: [{letter: A, name: Keep the fast loader, pros: [...], cons: [...]}, ...]
    default: null             # the option the agent may assume, if any
  urgency: turn-end           # now | turn-end
  links:
    - {rel: blocks, to: item:9}
    - {rel: about, to: github:nhooey/coding-agent-kanban-turns#49}
```

**Kinds.** A kind earns its place only if it has its own transition table, its own resolution payload, or its own controls.

| Kind     | What is asked of the owner | Resolution outcomes                                        | Controls it needs       |
| -------- | -------------------------- | ---------------------------------------------------------- | ----------------------- |
| task     | An action                  | `done`, `dropped`, `failed`, `transferred`, `superseded`    | Done, Drop, Hand over   |
| question | Information or a choice    | `answered`, `assumed`, `withdrawn`, `superseded`            | Options, text field     |

Decision, approval and review pass none of the three tests on their own:

- A **decision** is a question with options.
- An **approval** is a question whose options are yes and no and which has a `blocks` link to the action it gates.
- A **review** is a task for the user with an `about` link to an artefact; what closes it comes from the artefact's type, such as a merged pull request.

They stay as presets, which are named bundles of defaults in the spec, so the vocabulary and glyphs survive without adding transition tables.

**Actors.** An actor is a class and an identity: `user`, `agent:<id>` (main loop, a subagent, a teammate, a peer session) or `external:<name>` (CI, GitHub, a named person, a timer).
An item has 2 actor fields, because they have different rights:

- `raised-by`: who created it, and may withdraw or supersede it;
- `owner`: whose move it is, and who resolves it.

**States.** Three stored states, which are the 3 categories every tracker converges on:

| State  | Meaning                         | Reachable for                          |
| ------ | ------------------------------- | -------------------------------------- |
| open   | Nobody has started              | every item                             |
| active | The owner has visibly started   | tasks only                             |
| closed | Finished, with a resolution     | every item                             |

Derived, never stored:

- `blocked`: not closed, and some `blocked-by` target is not closed;
- `ready`: open and not blocked;
- `stale`: owned by `external`, and its watch has reported nothing for longer than a setting allows;
- `new`: raised in the latest turn.

Not item state at all: a picked-but-unsent answer.
The pane's Queued and Sent are a pending event in the presentation layer, shown on the item and dropped or committed at Submit.

**Resolution.** `{outcome, payload, by, in, evidence}`:

- `payload`: the letters and note for `answered`, the tracker link for `transferred`, the newer item for `superseded`;
- `by`: the actor;
- `in`: the turn;
- `evidence`: what proves it, such as a prompt id, a tool-call id or a notification id.

As a sum type, an open item has no resolution field and a closed one must have one, so "closed without saying why" cannot be built.

### 2.3 Events and the transition table

Items change only by events.
An event is `{verb, item, by, in, at, args, evidence}`.

| Verb       | From → to                   | Who may fire it                                   | Notes                                                                     |
| ---------- | --------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------- |
| `raise`    | nothing → open              | any actor                                         | May carry `supersedes`, which closes the older item as `superseded`       |
| `start`    | open → active               | owner                                             | Tasks only                                                                |
| `pause`    | active → open               | owner                                             | Tasks only                                                                |
| `assign`   | open or active → open       | owner, raiser, user                               | Sets `owner`; this is Todo ↔ Pending                                      |
| `resolve`  | open or active → closed     | owner; user always; an observer through a watch   | Carries the outcome and payload                                           |
| `assume`   | open → closed (`assumed`)   | raiser, only when the question has a `default`    | The agent goes on with the default; the user may reopen                   |
| `withdraw` | open or active → closed     | raiser, user                                      | Outcome `withdrawn`                                                       |
| `reopen`   | closed → open               | user on anything; an agent on tasks it owns       | An agent never reopens a question the user answered; it raises a new one  |
| `link`     | no state change             | raiser, owner                                     | Adds or removes `blocked-by` or `about`                                   |
| `observe`  | no state change by itself   | the harness or the mod's poller                   | Records a link target's status; a watch rule may turn it into `resolve`   |

The 3 event sources:

- **The agent**, through one tool, `item` (raise, start, assign, resolve, withdraw, link). The tool validates against the table and refuses an illegal event with a reason, which replaces linting prose after the fact.
- **The user**, through a control or the reference grammar in a prompt: `12.B`, `12: words`, `12 done`, `12 drop`, `12 to agent`.
- **Observations**, from hooks and polls: a task notification, a subagent's `turn.complete`, a merged pull request, an expired monitor.

`reassess` is a user event with a deterministic rule: at the end of a reassess turn, every item the agent raised that it did not re-raise or explicitly keep in that turn closes as `withdrawn`, with the reassess prompt as evidence.

### 2.4 Relations

Store the minimum and derive the rest.

| Relation     | From → to                     | Stored | Meaning                                                              |
| ------------ | ----------------------------- | ------ | -------------------------------------------------------------------- |
| `blocked-by` | item → item, entity, artefact | yes    | The item cannot move until the target closes                         |
| `blocks`     | the inverse                   | no     | Drawn as "frees #9" on the blocker                                   |
| `supersedes` | item → item                   | yes    | The older item is closed as `superseded`; references forward to the head |
| `about`      | item → artefact or entity     | yes    | What the item concerns; its type supplies the watch rule             |

`depends-on` is `blocked-by` under another name, so only one is kept.
`part-of` (subtasks) is left out: a topic is a label, and nesting adds a second hierarchy the pane would have to draw.

### 2.5 Invariants, each checkable by a test over the event log

1. Every item has exactly one kind, one owner and one state.
2. An item is closed exactly when it has a resolution.
3. An agent's `resolve` on an item the user owns is refused, with 2 exceptions: `assume` on a question with a `default`, and a resolve that cites the user's own prompt as evidence (open question 5).
4. An item owned by `external` has at least one link with a watch rule; otherwise the tool refuses it, since nothing could ever close it.
5. `blocked-by` and `supersedes` are acyclic.
6. A question's options never change after `raise`; a change is a new item that supersedes it.
7. An answer addressed to a superseded item applies to its head only when the head's options are letter-for-letter the same; otherwise it is refused with a pointer to the head.
8. The fold is a pure function of the log; replaying the log from empty gives the same items.
9. No view stores item data; every list, count and section is a named filter in the spec.
10. For every transition the user may fire there is exactly one control, and no control exists without a transition.

## 3. The critique of the candidate sketch

| Part of the sketch                                        | Verdict     | Why                                                                                                                                                                                                                     |
| --------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kinds: task, decision, review, approval, question         | Over-built  | 5 kinds repeat the mistake at a smaller size. Decision and approval are questions that differ in options; review is a task with an artefact link. 2 kinds plus presets.                                                  |
| Actor: human, agent, external                             | Incomplete  | It needs an identity (which subagent, which CI), and it conflates the raiser with the owner, who have different rights.                                                                                                  |
| "The current actor is the only one who resolves it"       | Wrong       | 4 counter-examples: the raiser withdraws or supersedes its own question; a merged pull request closes the user's review; the user may close anything; the agent may assume a default. Authority is a per-verb table.      |
| State: open, active, closed                               | Right       | It matches GitHub, Jira and Linear, and maps onto the harness's own task and agent statuses. But `active` applies to tasks only, `blocked` is derived, and Queued is presentation state, not a 4th state.                |
| Resolution                                                | Right       | Make it a sum-type field with evidence, and give each kind a closed list of outcomes.                                                                                                                                    |
| A spec table of transitions                               | Right       | Add the who-may-fire column and the invariants, so the tool can refuse an illegal event when it is written.                                                                                                              |
| Events: the agent's tool call and the human's answers     | Incomplete  | The 3rd source is missing: harness and external observations. Without it, Waiting and Review can never close deterministically.                                                                                          |
| State is a fold over events                               | Right       | Over-built only if it gets its own store. The transcript is already an append-only log that rewinds, forks and resumes correctly.                                                                                        |
| Lists and pane branches are filtered views                | Right       | But it implies more than the sketch says: the agent must stop writing the lists in prose, or there are 2 sources again. The reply's digest has to be rendered from the turn's events.                                     |
| Todo and Pending are the same kind with different owners  | Right       | And `assign` is the event between them.                                                                                                                                                                                  |
| Relations: supersedes, blocks, depends-on                 | Over-built  | `blocks` and `depends-on` are one relation and its inverse. `about` is missing, and it is the one that connects items to harness entities and artefacts.                                                                 |

Three things the sketch has no place for:

- **Blocking versus deferred.** AskUserQuestion and a Decide item are the same question delivered 2 ways. The model needs `urgency`.
- **Assumptions.** An agent that proceeds on a default has made a decision the user can overturn. That is `assume`, and today it is invisible.
- **Identity.** The sketch keeps the item's list in its name. The id must survive `assign` and a preset change.

## 4. The mapping to harness entities

"Is" means the harness already holds this as an entity with a lifecycle, so the mod projects it and never asks the agent to retype it.
"Linked" means an item points at it and its events feed the fold.
"Context" means it scopes or carries items and is never one.

| Harness entity                              | Its own states (from the types and docs)                                            | Relation to items | How the model uses it                                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Session                                     | started, running, ended; resumed, forked                                             | Context           | The scope of the log and of item ids.                                                                                              |
| Turn                                        | `turn.start` → `turn.complete` with a stop reason                                    | Context           | Groups events; `raised-in` and `resolution.in` name it. The reply's digest is one turn's events.                                   |
| Prompt                                      | composed, submitted; origin user, plugin, peer, task notification, wakeup            | Context           | The carrier of the user's events. Only the user's own text may answer.                                                             |
| Task list task (`TaskCreate`, `TaskUpdate`) | `pending`, `in_progress`, `completed`, `deleted`; `owner`, `blocks`, `blockedBy`     | Is                | An agent-owned task, the harness's native form of Pending and Done. Project it; do not have the agent write it twice.              |
| Subagent, teammate                          | `AgentStatus`: pending, running, waiting, idle, completed, failed, killed            | Is, and linked    | A delegated task owned by `agent:<id>`. Read from `$.agent.list()`; drawn as a link target on the item it blocks.                  |
| Background shell                            | running; completed, failed, killed; moved to background at timeout                   | Linked            | A `blocked-by` target. `Stop`'s `background_tasks` lists those in flight.                                                          |
| Monitor                                     | running, expired, stopped; emits a line per event                                    | Linked            | The mechanism of a watch: what turns an external change into an `observe` event.                                                   |
| Workflow, remote agent                      | running; completed, failed, killed                                                   | Linked            | As a background shell.                                                                                                             |
| Task notification                           | a single event: `{id, status, toolUseId, durationMs}`                                | Event             | An `observe` event. It resolves or unblocks whatever links to that task id.                                                        |
| Cron, `ScheduleWakeup`                      | scheduled, fired, deleted                                                            | Linked            | A watch on time: "check again at 15:00". `Stop`'s `session_crons` lists them.                                                      |
| Tool call                                   | requested → checked (allow, ask, deny) → running → result or failure                 | Event carrier     | The `item` tool call is the agent's event. Other calls are evidence (`toolUseId`).                                                 |
| Permission prompt                           | requested → allowed or denied, with a scope                                          | Is                | A native approval: a blocking yes-or-no question owned by the user. Never redrawn; a denial may be logged as a closed item.        |
| `AskUserQuestion`, `$.ui.ask`, elicitation  | asked → answered, or continued after a timeout                                       | Is                | A native question with `urgency: now`. Same shape as a Decide item: 2 to 4 options, multi-select, free text.                       |
| Plan mode, `ExitPlanMode`                   | planning → plan presented → approved or rejected                                     | Is                | A native review: a task for the user about the plan file. Never redrawn.                                                           |
| Hook                                        | registered; fires per event                                                          | Neither           | The mod's sensors (`turn.complete`, `TaskCreated`, `TaskCompleted`, `SubagentStop`, `PermissionDenied`) and its guard (`tool.check`). |
| Worktree                                    | created, entered, exited, removed                                                    | Linked            | Where a task's work happens: an `about` link and a label, never an item.                                                           |
| Peer session, `SendMessage`                 | a message with a sender                                                              | Event carrier     | A peer's report is an `observe` event, never an answer.                                                                            |
| Checkpoint, rewind                          | conversation restored to an earlier prompt                                           | Context           | Truncates the log, so the fold reverts by itself. The main argument for keeping the log in the transcript.                         |
| Compaction                                  | `PreCompact` → `PostCompact`                                                         | Context           | The log must be read from the file, not the model's context; the board is re-sent to the model afterwards.                         |
| MCP server, channel                         | connecting, connected; pushes messages                                               | Event source      | External `observe` events.                                                                                                         |
| Notification, `PushNotification`            | sent                                                                                 | Neither           | A delivery channel for "an item needs you" while the user is away.                                                                 |
| Pull request, issue, CI run                 | their own                                                                            | Artefact, linked  | `about` targets with watch rules: merged → `done`, closed → `dropped`.                                                             |

The mod's own items, sorted the way the question asks:

| Today's list     | Is a harness entity                                   | References one                                     | Neither                                      |
| ---------------- | ----------------------------------------------------- | -------------------------------------------------- | -------------------------------------------- |
| Pending, Done    | Yes: task list tasks, where the model has the tools   |                                                    |                                              |
| Waiting          | Sometimes: a running subagent is itself the task      | Usually: a shell, a monitor, a cron, CI, a person  |                                              |
| Logged           |                                                       | An issue or tracker entry                          |                                              |
| Review           | Only for a plan, through `ExitPlanMode`               | A pull request                                     |                                              |
| Authorizations   | Only what a permission prompt can express             | The action it gates                                | The rest: grants no permission rule covers   |
| Decide           | Only when asked now, through `AskUserQuestion`        |                                                    | The deferred ones: the mod's own             |
| Todo             |                                                       |                                                    | The mod's own: the harness has no task for a human |
| Answers          |                                                       |                                                    | Prose: a question born closed                |
| 📌 roll-up       |                                                       |                                                    | A view                                       |

So the harness has first-class entities for the agent's tasks and for blocking human input, and none for deferred human input.
That gap, items the user owns that do not stop the turn, is the mod's real territory.
The rest should be projected or linked.

## 5. Display rules

### 5.1 The rules

1. **One row grammar everywhere**: `<state> <kind> #<id> <summary> · <owner> · <status clause>`.
2. **One visual channel per field.** The state is the mark (`○` open, `◐` active, `●` closed) and dimming. The kind is the glyph (`☐` task, `?` question). The owner is the section, or the word after the summary. No glyph means 2 fields at once, which is what 🚧 and 👉 do today.
3. **Three densities of one component**: a chip (a count), a line (the row grammar) and a card (the line, the body and the controls). The transcript and the pane call the same renderer.
4. **A card's controls come from the transition table**: one control per transition the user may fire on that item, in a fixed order.
5. **An item is drawn as a card where the user must act, and as a line everywhere else.** In the transcript that is its `raise` in the latest turns; in the pane, the section "Yours".
6. **The transcript shows events; the pane shows state.** A reply ends in a digest of that turn's events, grouped by verb. It never restates earlier items: one count line links to the pane.
7. **Every drawing is live.** An old reply's row for an item that has since closed is dim and carries its resolution.
8. **Harness entities and artefacts appear only as a status clause on the item that links to them**, with their live state: `blocked by shell b3f1 (running 2m)`. They get no rows of their own, since the harness draws them already.
9. **The pane's tree groups by facets, in an order the user sets.**
   - **Facets:** any item field or derived field: owner, state, kind, preset, turn, urgency, blocked.
   - **The order:** the user sets which facets group the tree, from first to last. Each level of the tree groups by one facet's values, and every node at every level is a toggle, as on the user's request of 2026-11-27.
   - **Where the order lives:** as view state, stored per user, and changed from the pane itself, for example by moving a facet up or down in a header control. It isn't a setting that needs a reload.
   - **Defaults:** the order starts as owner, then state, then turn. "Yours" is open; "Agent's", "External" and "Closed" are collapsed to a count and one line.
   - **What happens on a change:** a reorder keeps the expanded or collapsed state of each node whose path still exists, and updates only the counts.
10. **Within a section, blockers come first**, then the newest.
11. **A pending answer is drawn the same in both places**, as a mark on the option (`◉`) and a clause (`queued: B`), until Submit commits it.
12. **What is special, and why**: a question's options, because each is a target; items that block the agent, because they cost the most to leave; nothing else.

### 5.2 The transcript

```text
The spec now compiles to one module, and the parser reads it. The loader
question below decides what the next step builds.

── 0f311c94 ────────────────────────────────────────────────────────────
Raised
  ○ ? #12 Which loader to keep · you · frees #14
      Both are built; this only picks the default.
      ( ) A  Keep the fast loader: it survives restarts
             + faster cold starts    - disk use
      ( ) B  Keep the small loader: simpler
             + less code             - slow cold starts
      ✎ answer in words
  ○ ☐ #13 Review PR #49 "Read the protocol's rules from one YAML spec" · you
      PR open, checks passing; closes when it merges
      [✓ Done] [✗ Drop] [↪ To agent]
  ○ ☐ #14 Port the parser tests · agent · blocked by #12
Closed
  ● ☐ #9  Compile the spec · agent · done
  ● ? #7  Which port to serve on · you · answered B
Changed
  ◐ ☐ #11 Rebase the stack · agent · blocked by shell b3f1 (running 2m)
Open: you 2 · agent 2 · external 0                              ▸ Board
```

### 5.3 The pane

```text
╭ Board · you 2 · agent 2 · external 1 ─────────── k ↑  j ↓  h ?  q ✖ ╮
│ ▾ Yours (2)                                                         │
│   ○ ? #12 Which loader to keep                  0f311c94 · frees #14│
│       Both are built; this only picks the default.                  │
│       (◉) A  Keep the fast loader: it survives restarts             │
│              + faster cold starts    - disk use                     │
│       ( ) B  Keep the small loader: simpler                         │
│       ✎ answer in words                                             │
│   ○ ☐ #13 Review PR #49 "Read the protocol's rules…"       0f311c94 │
│       PR open, checks passing; closes when it merges                │
│       [✓ Done] [✗ Drop] [↪ To agent]                                │
│ ▸ Agent's (2)    ◐ #11 Rebase the stack · ○ #14 blocked by #12      │
│ ▸ External (1)   ○ #15 CI on PR #49 · running 4m                    │
│ ▸ Closed (14)                                                       │
│                                                                     │
│ Draft: 12.A                                r ↺ Reassess  s ⏎ Submit │
╰─────────────────────────────────────────────────────────────────────╯
```

The count line above the prompt is the same data at chip density: `Board · you 2 · agent 2 · external 1 · ✎ 1 queued`.

## 6. The UI concepts and what each dictates

| Concept                                           | Source                                                                                                                                                                                                                             | What it dictates here                                                                                                                                                                          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model-view separation                             | Reenskaug, "Models-Views-Controllers", Xerox PARC note, 1979; Krasner and Pope, "A Cookbook for Using the Model-View-Controller User Interface Paradigm in Smalltalk-80", JOOP 1(3), 1988                                           | A list is a view. The model holds no "Decide list", only items; the reply's text is one rendering.                                                                                              |
| Presentation model                                | Fowler, "GUI Architectures", 2006, and "Presentation Model", 2004                                                                                                                                                                   | The draft, the focus and which sections are open are view state, kept apart from item state. Queued is not a 4th item state.                                                                    |
| Statecharts                                       | Harel, "Statecharts: A Visual Formalism for Complex Systems", Science of Computer Programming 8, 1987; Horrocks, "Constructing the User Interface with Statecharts", 1999                                                           | States and transitions are an explicit table with guards. Closed has sub-states, the outcomes. `blocked` is a condition over other items, not a state.                                         |
| Event sourcing                                    | Fowler, "Event Sourcing", 2005; Young, "CQRS Documents", 2010; Helland, "Immutability Changes Everything", CIDR 2015                                                                                                                | State is a fold over an append-only log. A correction is a new event (`reopen`), never an edit. A resume or a rewind rebuilds by replaying.                                                    |
| Unidirectional data flow                          | Czaplicki, The Elm Architecture; Redux, "Three Principles" (single source of truth, read-only state, pure reducers)                                                                                                                 | A click produces an event; only the reducer changes state; views re-render. No view writes another view.                                                                                       |
| Illegal states unrepresentable                    | Minsky, "Effective ML", 2011; King, "Parse, Don't Validate", 2019                                                                                                                                                                  | An item is a sum type: closed carries a resolution, open cannot. The tool parses an event into a legal one or refuses it; nothing is linted after the fact.                                    |
| The type, state and assignee split                | GitHub issues (state, `state_reason`, assignees, issue types); Jira (issue type, status and its 3 status categories, resolution, assignee); Linear (workflow state types)                                                           | Kind, state, owner and resolution are orthogonal fields. 3 state categories. The resolution is separate from the state.                                                                        |
| Kanban                                            | Ohno, "Toyota Production System", 1988; Anderson, "Kanban", 2010                                                                                                                                                                   | Columns are states, swimlanes are a 2nd field, and cards have types. The 9 lists flatten all 3 into one axis. "Make policies explicit" is the transition table.                                |
| Conversation for action                           | Winograd and Flores, "Understanding Computers and Cognition", 1986; Winograd, "A Language/Action Perspective on the Design of Cooperative Work", Human-Computer Interaction 3(1), 1987                                              | The 2 kinds are the 2 requests, for action and for information. Every open item has exactly one party whose move it is. Decline, withdraw and counter are outcomes, not failures.              |
| Object-oriented UI and noun-verb order            | IBM, "Object-Oriented Interface Design: IBM Common User Access Guidelines", 1992; Collins, "Designing Object-Oriented User Interfaces", 1995; Raskin, "The Humane Interface", 2000; Prater, "Object-Oriented UX", A List Apart, 2015 | The user picks an item, then a verb the item offers. An object looks the same wherever it appears. A reference is noun then verb, `12.B` or `12 done`, and the noun does not encode its type.  |
| Direct manipulation                               | Shneiderman, "Direct Manipulation: A Step Beyond Programming Languages", IEEE Computer 16(8), 1983; Hutchins, Hollan and Norman, "Direct Manipulation Interfaces", Human-Computer Interaction 1(4), 1985                             | Act on the item where it is drawn, and see the result at once. Actions are small and reversible: a click toggles a draft, Submit commits, `reopen` undoes.                                     |
| Progressive disclosure                            | Carroll and Rosson, "Paradox of the Active User", 1987; Nielsen, "Progressive Disclosure", Nielsen Norman Group, 2006                                                                                                               | 3 densities: chip, line, card. Collapsed sections show a count. Pros and cons are part of the card, not the line.                                                                              |
| Overview first, zoom and filter, details on demand | Shneiderman, "The Eyes Have It", IEEE Visual Languages, 1996                                                                                                                                                                        | The count line is the overview, the pane's sections are the filter, the card is the detail. Each is one step from the last.                                                                    |
| Single source of truth                            | Codd, "A Relational Model of Data for Large Shared Data Banks", CACM 13(6), 1970; Hunt and Thomas, "The Pragmatic Programmer", 1999 (DRY)                                                                                           | An item's facts live in the log once. No prose list beside a tool call, no hand-written roll-up, no retyped subagent status.                                                                   |
| One thing, many views                             | North and Shneiderman, "Snap-Together Visualization", AVI 2000; Roberts, "State of the Art: Coordinated and Multiple Views", CMV 2007                                                                                               | The digest, the pane and the count line are filters of one fold and stay linked: a pick in one shows in all.                                                                                   |
| One visual variable per data field                | Bertin, "Semiology of Graphics", 1967; Wertheimer, "Laws of Organization in Perceptual Forms", 1923                                                                                                                                | Kind is the glyph, state is the mark, owner is the group. Similar things look similar, and grouped things sit together.                                                                        |
| Usability heuristics                              | Nielsen, "Enhancing the Explanatory Power of Usability Heuristics", CHI 1994                                                                                                                                                       | Status is visible (live rows), display is consistent (one row grammar), and recognition beats recall (a control instead of a typed reference).                                                 |
| Mixed initiative                                  | Horvitz, "Principles of Mixed-Initiative User Interfaces", CHI 1999; Amershi et al., "Guidelines for Human-AI Interaction", CHI 2019                                                                                                | Interrupting costs something, so a question carries `urgency`. The agent may act on a default if the act is visible and cheap to overturn: `assume` and `reopen`.                              |
| Fitts's law                                       | Fitts, Journal of Experimental Psychology 47(6), 1954; MacKenzie, Human-Computer Interaction 7(1), 1992                                                                                                                             | It applies weakly in a terminal. Make every line of an option one target, put controls on the item, and keep Submit in a fixed place. Keys beat the pointer here.                              |
| Hick-Hyman law                                    | Hick, Quarterly Journal of Experimental Psychology 4(1), 1952; Hyman, Journal of Experimental Psychology 45(3), 1953                                                                                                                | It applies to choosing among known options, not to reading a list. Keep a question to about 4 options and a card to at most 3 controls; show only "Yours" by default.                          |

## 7. Open questions, each with a recommendation

| #  | Question                                                        | Options                                                                                               | Recommendation                                                                                                                                                                                                 |
| -- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | Where does the event log live?                                  | The transcript; the plugin's `$.store`; the harness's task list                                       | The transcript. It is append-only already, and it rewinds, forks and resumes with the conversation. A store would drift from it; the task list lets the agent complete anything.                               |
| 2  | How many kinds?                                                 | 2 with presets; 5                                                                                     | 2 with presets. Add a kind only when it needs its own transition table.                                                                                                                                        |
| 3  | Are the agent's own tasks the harness's tasks or the mod's?     | Project `TaskCreate` and `TaskUpdate`; have the agent raise them through `item` too                   | Project them, where the model has the task tools, and fall back to `item` where it does not. The cost: task-list tasks are often smaller than a turn-level commitment, so "Agent's" stays collapsed.           |
| 4  | What is an item's id?                                           | A session ordinal, `#12`; `<turn>.<n>`                                                                | The session ordinal, assigned in log order and echoed in the tool's result. `12.B` is short enough to type. Qualify it with the session only across sessions.                                                  |
| 5  | How does a typed answer in plain words become an event?         | Grammar only; the agent records it for the user                                                       | Both, marked by provenance. The grammar is deterministic. The agent may record `resolve … by user` only citing the user's own prompt, which the tool checks exists and is later than the raise; the row then says "as the agent read it", and `reopen` undoes it. |
| 6  | Does the agent still write the lists in prose?                  | Yes, and the mod parses them; no, the mod renders the turn's events                                   | No. The tool's row is the digest. The tool's result carries the same digest as plain text, so a transcript read without the mod still shows it. Without the mod at all, the skill's prose lists remain.        |
| 7  | Are blocking and deferred questions one thing?                  | Unify under `urgency`; leave `AskUserQuestion` alone                                                  | One model, 2 deliveries. First only observe `AskUserQuestion` and record it as a question born closed, so history is whole; route `urgency: now` through it later.                                             |
| 8  | Does a finished agent task need the user's acceptance?          | An `accept` step, as in conversation for action; none                                                 | None. Silence accepts and `reopen` rejects. Where acceptance matters, the agent raises a review, which is that step as an item.                                                                                |
| 9  | Does the pane show items the user does not own?                 | Yes, collapsed; no                                                                                    | Yes, collapsed. They explain why the agent is idle, and they cost one line.                                                                                                                                    |
| 10 | Is an approval its own kind?                                    | A preset of question; a kind with scopes such as "always"                                             | A preset. A standing grant is a permission rule, which is the harness's to hold.                                                                                                                               |
| 11 | Are the user's questions in a prompt items?                     | Items born closed; prose                                                                              | Prose, unless the agent cannot answer in that turn. Then it is a task the agent owns, linked to the prompt.                                                                                                    |
| 12 | Do items outlive a session?                                     | A board across sessions; session scope with a transfer                                                | Session scope. Work that must outlive it is resolved as `transferred` with a link to an issue or a plan node, which is what Logged meant.                                                                      |

One consequence that is not a question: the lists, the reference grammar and what settles an item are shared with the `coding-agent-kanban-turn-responses` skill, so adopting any of this means the matching change there.

## 8. What to check first

Three cheap tests would confirm or sink the model before anything is built:

1. **The filter table.** Take the transcripts the differential tests already use, hand-label each list item with kind, owner and state, and see whether every item fits one row of the table in section 1. An item that fits none is a missing field.
2. **The transition table.** For each pair of consecutive turns in which an item moved between lists, name the event. A move with no verb in section 2.3 is a missing transition.
3. **The projection.** In one session that uses `TaskCreate`, compare the agent's Pending list with the task list's open tasks at the turn's end. If they differ often, question 3's answer flips towards the agent raising its own turn-level tasks.

## 9. What the person decided and added

The person's words are quoted; the rest is how the plan reads them.

### 9.1 The answers to the open questions

| Question                         | Answer                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 2, how many kinds                | Two, task and question, with decision, approval and review as presets in the spec (`64b1cbcd.Decide.1.A`).                                     |
| 6, the lists in prose            | Not the recommendation above. "Keep outputting in both places, with links to the items in the prose, so they appear in the transcript, but can also appear more structured in the pane" (`64b1cbcd.Decide.2`). |
| 1, 4 and 12, the log and the ids | The log lives in the transcript, items are session-scoped, ids are session ordinals, and work that outlives a session is transferred to an issue or a plan node (`64b1cbcd.Decide.3.A`). |
| What to build first              | Plan it first: an end-state node, with the queued pane refactors folded into it, before more pane code is written (`64b1cbcd.Decide.4.A`).      |

### 9.2 The rules added

- **The shape of the code.**
  "When planning this fundamental structure change, ensure the code ends up in a way where the types and states can be easily changed, and the display of stuff is algorithmic. You can infer my intent in letting the user specify the group-by precedence. The UI and the shape of the data should be in sync, so there is no arbitrarily different UI layer, and it's as simple as possible, with no special things unless necessary."
  So kinds, states and events are data in the spec, every view is a pure function of the items and the view state, and what's special is named in the spec with its reason.
- **The facet order.**
  Display rule 9 stands: the pane's tree groups by facets in an order the person sets, each level one facet and each node one value.
- **One control per line.**
  "Use emojis for the buttons on a todo, and give them each a line, so the shape is the same as any other type."
  Every item's controls, a task's Done, Skip and note and a question's options alike, are one to a line, each opening on its emoji, laid out by one function that takes a control and no kind.
  This replaces the row of bracketed buttons in sections 5.2 and 5.3.
- **A click moves the item.**
  "In the plan, ensure that clicking on something changes its state and moves it its new home."
  A press is an event the reducer applies at once, and the tree draws the item under the node its new state belongs in, with every other node's fold kept.
- **Queued is the draft's text.**
  "There is also an intermediate state where the user clicks on something, but hasn't submitted, so those items should be queued, then they get cemented when the submission happens, which of course needs to be scanned because the user can edit the queued items by hand. So the user could delete a queued decision selection, thereby keeping it outstanding."
  A press writes a line into the prompt draft, what is queued is the parse of that text on every change, a hand edit counts as a press does, and Submit cements what the submitted text holds, never what was pressed.
- **Reassess.**
  "A `Reassess` that gets submitted, should also close the pane while it's working, and also change the state of outstanding things because they're being reassessed. Figure out something reasonable so that when you reassess, you can see that the old outstanding things don't need to be acted on and that you only need to pay attention when the reassess is complete."
  A submitted reassess is an event, closes the pane, and holds the items it covers as being reassessed, a derived condition, under one folded node with no controls, until its turn ends.
- **A clean architecture, and no compatibility.**
  "Add any necessary and desirable refactorings to the beginning of the plan, to ideally clean up the project in preparation for what it's going to implement. Some parts can refactor as it goes. Whatever is suitable, just ensure the end state is a very clean architecture. Ignore the status quo, nobody uses this except for me."
  "Break out the refactoring in to its own plan with the same prefix."
  The refactors are a plan of their own, items-events-views-refactor, which the model's nodes wait on: it deletes compatibility code, and holds its end state to one module per layer with imports one way.
  It also settles question 12's corollary: a session begun before the change shows nothing from before, and no importer is written.
