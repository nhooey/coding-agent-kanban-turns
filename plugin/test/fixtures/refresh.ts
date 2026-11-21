// What the refresh's pane-state tests and its differential test drive the
// refresh with, beside Submit's fixtures in ./submit.ts: the transcripts a
// read may find, what `gh` may say merged, and the random events and
// answers fast-check draws from them, presses and their answers among
// them, since Submit holds the answers a refresh takes out.

import fc from "fast-check";

import type { Effect, Event, Found } from "../../src/pane/pane-state.ts";
import type { DecideItem, Settings, Turn } from "../../types/index.d.ts";
import {
  ENGINE,
  ITEMS,
  answerTo,
  eventArb,
  replyArb,
  walkWith,
} from "./submit.ts";
import type { CommandOf, Reply } from "./submit.ts";
import { turnOf } from "./turns.ts";

/** The count line's settings, as the defaults give them. */
export const COUNTS: Settings["counts"] = { turns: 5, "gh-timeout-ms": 5000 };

/** The pull request the raising turn's Review item names. */
export const PULL = "nhooey/kanban#21";

const REVIEW_REPLY = [
  "Work.",
  "",
  "🔍 **Review:**  ",
  "1. **[#21 Close the pane](https://github.com/nhooey/kanban/pull/21)**",
  "",
].join("\n");

const RAISING = turnOf("9efb08a1", "go", { replies: [REVIEW_REPLY], decide: ITEMS });

/**
 * The transcripts a read may find: both items open; the first answered in
 * a later turn; both reassessed, the Review item with them. Each later
 * one's turns follow the earlier's, as a session's do.
 */
export const TRANSCRIPTS = {
  open: [RAISING],
  answered: [
    RAISING,
    turnOf("b2c3d4e5", "9efb08a1.Decide.1.B", { replies: ["On it."] }),
  ],
  reassessed: [RAISING, turnOf("c3d4e5f6", "reassess", { replies: ["Prose."] })],
} as const satisfies Record<string, readonly Turn[]>;

export const GONE = "the transcript is gone";

/** What a read may find: one of the transcripts, or a transcript that can't be read. */
export const foundArb: fc.Arbitrary<Found> = fc.oneof(
  { arbitrary: fc.constantFrom(...Object.values(TRANSCRIPTS)).map((turns): Found => ({ turns, counts: COUNTS })), weight: 4 },
  { arbitrary: fc.constant<Found>({ problem: GONE }), weight: 1 },
);

/** What the settings files may say was wrong with them. */
export const warningsArb: fc.Arbitrary<readonly string[]> = fc.constantFrom(
  [],
  ["config.yaml: bad key"],
);

/** What `gh` may say merged. */
export const mergedArb: fc.Arbitrary<readonly string[]> = fc.subarray([PULL]);

/** An item no transcript raises, which a `kanban_options` call may draw. */
export const DRAWN: DecideItem = {
  ...ITEMS[0]!,
  turn: "d4e5f6a7",
  ref: "d4e5f6a7.Decide.1",
  summary: "Which branch to cut",
};

/** What the engine answers any call with: a prompt call as Submit's fixtures say, a transcript read with what it found, `gh` with what merged. */
export type PaneReply = Reply &
  Readonly<{ found: Found; warnings: readonly string[]; merged: readonly string[] }>;

export const paneReplyArb: fc.Arbitrary<PaneReply> = fc
  .tuple(replyArb, foundArb, warningsArb, mergedArb)
  .map(([reply, found, warnings, merged]) => ({ ...reply, found, warnings, merged }));

/** The event the hooks dispatch when the call `effect` asked for answers with `reply`; none for an effect that asks nothing. */
export const paneAnswerTo = (effect: Effect, reply: PaneReply): Event | undefined =>
  effect.kind === "read-transcript"
    ? {
        type: "transcript-read",
        refresh: effect.refresh,
        found: reply.found,
        warnings: reply.warnings,
      }
    : effect.kind === "ask-merged"
      ? {
          type: "merged-found",
          found: reply.merged.filter((ref) => effect.refs.includes(ref)),
          asked: effect.asked,
        }
      : answerTo(effect, reply);

/** The effects that ask something and answer with an event: the prompt calls, transcript reads and `gh`. */
export const PANE_ASKS: readonly Effect["kind"][] = [
  ...ENGINE,
  "read-transcript",
  "ask-merged",
];

/**
 * Any event the pane takes: Submit's, and the refresh's, a turn's end's
 * refresh, which releases what Submit held, among them; stray transcript
 * reads, dropped reads and `gh` answers, for any refresh, too.
 */
export const paneEventArb: fc.Arbitrary<Event> = fc.oneof(
  { arbitrary: eventArb, weight: 6 },
  {
    arbitrary: fc.boolean().map((releases): Event => ({ type: "refresh-asked", releases })),
    weight: 4,
  },
  fc
    .subarray([...ITEMS, DRAWN], { minLength: 1 })
    .map((items): Event => ({ type: "items-drawn", items })),
  fc.constantFrom<Event>({ type: "announced" }, { type: "seen" }),
  fc
    .constantFrom("s", "s2")
    .map((session): Event => ({ type: "session-joined", session })),
  fc
    .record({ refresh: fc.integer({ min: 1, max: 4 }), found: foundArb, warnings: warningsArb })
    .map((r): Event => ({ type: "transcript-read", ...r })),
  fc
    .integer({ min: 1, max: 4 })
    .map((refresh): Event => ({ type: "read-dropped", refresh })),
  fc
    .record({ found: mergedArb, refresh: fc.integer({ min: 0, max: 4 }) })
    .map(
      ({ found, refresh }): Event => ({
        type: "merged-found",
        found,
        ...(refresh === 0
          ? {}
          : { asked: { refresh, turns: TRANSCRIPTS.open, window: COUNTS.turns } }),
      }),
    ),
);

export type PaneCommand = CommandOf<PaneReply>;

// Answers outweigh events, so refreshes' reads answer out of order and
// presses reach their later stages.
export const paneCommandArb: fc.Arbitrary<PaneCommand> = fc.oneof(
  {
    arbitrary: paneEventArb.map((event): PaneCommand => ({ do: "event", event })),
    weight: 1,
  },
  {
    arbitrary: fc
      .record({ pick: fc.nat({ max: 5 }), reply: paneReplyArb })
      .map((r): PaneCommand => ({ do: "answer", ...r })),
    weight: 1,
  },
);

/** A random run: long enough for several refreshes to read at once, and to outlast a session's start. */
export const paneCommandsArb: fc.Arbitrary<readonly PaneCommand[]> = fc.array(
  paneCommandArb,
  { minLength: 20, maxLength: 80 },
);

/** The events `commands` make, each stepped from `from`, with the state before it: an answer command answers any call still waiting. */
export const walkPane = walkWith(paneAnswerTo, PANE_ASKS);
