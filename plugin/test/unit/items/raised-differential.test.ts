// The raised items, each holding where it stands, give what the settled
// refs and their settlements kept in two lists beside the items gave,
// test/oracle/raised.ts: over random sequences of items merged in,
// refreshes, reads that couldn't read the transcript, answers Submit sent,
// answers held and let go of, and looks, both say the same of every ref,
// a ref never raised among them: whether it's still open, settled, how it
// settled and whether it's unseen. The same goes for the items as the pane
// draws them, with the held answers Done.
//
// Temporary: deleted with the oracle once `raised-item-state-sum` has
// merged into `master`.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import * as core from "../../../src/items/raised.ts";
import type { DecideItem, Held, Raised, Settlement } from "../../../types/index.d.ts";
import * as oracle from "../../oracle/raised.ts";
import type { OldRaised } from "../../oracle/raised.ts";

const RUNS = 400;
const SEED = 0x72616973;

/** The item `n` of turn 9efb08a1, its content told apart by `note`. */
const itemOf = (n: number, note: readonly string[]): DecideItem => ({
  turn: "9efb08a1",
  list: "Decide",
  number: n,
  summary: `Item ${n}`,
  kind: "radio",
  ref: `9efb08a1.Decide.${n}`,
  options: [
    { letter: "A", name: "One" },
    { letter: "B", name: "Two" },
  ],
  note,
});

const NUMBERS = [1, 2, 3, 4] as const;
/** An item no command raises, which every observation asks about too. */
const NEVER = itemOf(9, []);
const REFS = [...NUMBERS.map((n) => `9efb08a1.Decide.${n}`), NEVER.ref];

const itemArb: fc.Arbitrary<DecideItem> = fc
  .tuple(fc.constantFrom(...NUMBERS), fc.constantFrom<readonly string[]>([], ["told"], ["told again"]))
  .map(([n, note]) => itemOf(n, note));

const itemsArb = fc.array(itemArb, { maxLength: 5 });
const lettersArb = fc.subarray(["A", "B"]);
const noteArb = fc.constantFrom("", "only the loader");

const settlementArb: fc.Arbitrary<Settlement> = fc.oneof(
  fc
    .tuple(fc.constantFrom(...REFS), fc.constantFrom("b2c3d4e5", "c3d4e5f6"), lettersArb, noteArb)
    .map(([ref, turn, letters, note]): Settlement => ({ ref, how: "answered", turn, letters, note })),
  fc
    .tuple(fc.constantFrom(...REFS), fc.constantFrom("reassessed" as const, "restated" as const))
    .map(([ref, how]): Settlement => ({ ref, how })),
  fc
    .tuple(fc.constantFrom(...REFS), lettersArb, noteArb)
    .map(([ref, letters, note]): Settlement => ({ ref, how: "sent", letters, note })),
);

const settlementsArb = fc.array(settlementArb, { maxLength: 5 });
const problemsArb = fc.subarray(["bad key", "worse key"]);

type Command = Readonly<
  | { do: "with-items"; items: readonly DecideItem[] }
  | {
      do: "refreshed";
      open: readonly DecideItem[];
      settlements: readonly Settlement[];
      problems: readonly string[];
      turns: readonly string[];
    }
  | { do: "unread"; problem: string; problems: readonly string[] }
  | { do: "with-sent"; sent: readonly Settlement[] }
  | { do: "with-held"; press: number; moved: readonly Settlement[] }
  | { do: "without-read"; keep: readonly boolean[] }
  | { do: "seen" }
  | { do: "for-session"; session: string }
>;

const commandArb: fc.Arbitrary<Command> = fc.oneof(
  itemsArb.map((items): Command => ({ do: "with-items", items })),
  fc
    .tuple(itemsArb, settlementsArb, problemsArb, fc.subarray(["9efb08a1", "b2c3d4e5"]))
    .map(([open, settlements, problems, turns]): Command => ({ do: "refreshed", open, settlements, problems, turns })),
  fc
    .tuple(fc.constantFrom("", "Error: no file"), problemsArb)
    .map(([problem, problems]): Command => ({ do: "unread", problem, problems })),
  settlementsArb.map((sent): Command => ({ do: "with-sent", sent })),
  fc
    .tuple(fc.integer({ min: 1, max: 3 }), settlementsArb)
    .map(([press, moved]): Command => ({ do: "with-held", press, moved })),
  fc.array(fc.boolean(), { maxLength: 6 }).map((keep): Command => ({ do: "without-read", keep })),
  fc.constant<Command>({ do: "seen" }),
  fc.constantFrom("s1", "s2").map((session): Command => ({ do: "for-session", session })),
);

type Sides = Readonly<{ old: OldRaised; now: Raised; held: readonly Held[] }>;

const START: Sides = {
  old: { ...oracle.emptyRaised, session: "s1" },
  now: { ...core.emptyRaised, session: "s1" },
  held: [],
};

/** Both sides once `command` runs; the held answers are the same functions' on either side, so one list serves both. */
const run = (sides: Sides, command: Command): Sides => {
  switch (command.do) {
    case "with-items":
      return { ...sides, old: oracle.withItems(sides.old, command.items), now: core.withItems(sides.now, command.items) };
    case "refreshed":
      return {
        ...sides,
        old: oracle.refreshed(sides.old, command.open, command.settlements, command.problems, command.turns),
        now: core.refreshed(sides.now, command.open, command.settlements, command.problems, command.turns),
      };
    case "unread":
      return {
        ...sides,
        old: oracle.unread(sides.old, command.problem, command.problems),
        now: core.unread(sides.now, command.problem, command.problems),
      };
    case "with-sent":
      return { ...sides, old: oracle.withSent(sides.old, command.sent), now: core.withSent(sides.now, command.sent) };
    case "with-held":
      return { ...sides, held: core.withHeld(sides.held, command.press, command.moved) };
    case "without-read":
      return { ...sides, held: core.withoutRead(sides.held, sides.held.filter((_, n) => command.keep[n] === true)) };
    case "seen":
      return { ...sides, old: oracle.seen(sides.old), now: core.seen(sides.now) };
    case "for-session":
      return {
        ...sides,
        old: oracle.forSession(sides.old, command.session),
        now: core.forSession(sides.now, command.session),
      };
  }
};

/** The items every observation asks about: each content the commands raise, and one never raised. */
const ASKED = [...NUMBERS.map((n) => itemOf(n, [])), NEVER];
const DRAFT = "9efb08a1.Decide.1.B: only the loader\n9efb08a1.Decide.3.A\n9efb08a1.Decide.9.A\n";

/** What the oracle's items say, of every ref asked about and as a whole. */
const observedOld = (raised: OldRaised, sent: readonly Settlement[]) => ({
  stillOpen: oracle.stillOpen(raised),
  unseen: oracle.unseen(raised),
  byRef: ASKED.map((item) => ({
    ref: item.ref,
    isSettled: oracle.isSettled(raised, item),
    settlement: oracle.settlementOf(raised, item),
  })),
  items: raised.items,
  turns: raised.turns,
  problems: oracle.problemsOf(raised),
  sentOf: oracle.sentOf(DRAFT, raised),
  answered: oracle.answeredCount(raised, DRAFT),
  closes: oracle.closesOnSubmit(raised, sent, true),
});

/** What the core's items say, as `observedOld` asks it. */
const observedNew = (raised: Raised, sent: readonly Settlement[]) => ({
  stillOpen: core.stillOpen(raised),
  unseen: core.unseen(raised),
  byRef: ASKED.map((item) => ({
    ref: item.ref,
    isSettled: core.isSettled(raised, item),
    settlement: core.settlementOf(raised, item),
  })),
  items: core.decideItemsOf(raised),
  turns: raised.turns,
  problems: core.problemsOf(raised),
  sentOf: core.sentOf(DRAFT, raised),
  answered: core.answeredCount(raised, DRAFT),
  closes: core.closesOnSubmit(raised, sent, true),
});

describe("the raised items, each holding where it stands", () => {
  test("say what the two lists beside the items said, of every ref, after every command, and as the pane draws them", () => {
    fc.assert(
      fc.property(fc.array(commandArb, { maxLength: 30 }), (commands) => {
        commands.reduce((sides, command) => {
          const next = run(sides, command);
          const sent = core.heldNow(next.held);
          expect(observedNew(next.now, sent)).toEqual(observedOld(next.old, sent));
          expect(observedNew(core.withSent(next.now, sent), sent)).toEqual(
            observedOld(oracle.withSent(next.old, sent), sent),
          );

          return next;
        }, START);
      }),
      { numRuns: RUNS, seed: SEED },
    );
  });
});
