// Gathering the facts once gives what working them out again in each
// reading gave, test/oracle/open-facts.ts: over random neutral turns that
// reassess, answer, free items and name pull requests, with random sets of
// merged pull requests and windows, what the turns leave open, the count
// line, the roll-up and every reading that feeds them. And `openOf` reads
// each turn's fields no more often than the derivations that read them, one
// reading each.
//
// Temporary: deleted with the oracle once `open-facts-computed-once` has
// merged into `master`.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import * as core from "../../../src/items/outstanding.ts";
import { itemsOf } from "../../../src/items/items.ts";
import type { Owner, Turn } from "../../../types/index.d.ts";
import * as oracle from "../../oracle/open-facts.ts";
import { said, turnOf } from "../../fixtures/turns.ts";

const RUNS = 400;
const SEED = 0x6f70656e;
const WINDOWS = [0, 1, 3, 20] as const;

const SEP = "⠀";

/** The id of the turn at place `n`. */
const idOf = (n: number): string => String(n).padStart(8, "0");

/** Every pull request a reply below names with its repository. */
const PULL_REQUESTS = [
  "example/kanban#21",
  "example/kanban#22",
  "example/other#7",
] as const;

/** References a `Frees:` line or a call may name: earlier turns' items, a later turn's, and items no turn holds. */
const REFS = [
  "00000000.Todo.1",
  "00000000.Pending.1",
  "00000001.Decide.1",
  "00000002.Pending.1",
  "00000003.Todo.1",
  "00000005.Decide.2",
] as const;

const DECIDE_REPLY = `Prose.

🧠 **Decide:**
▔▔▔▔▔▔▔▔▔▔
1. **Which cache to keep for the loader**
   🔘 A. **Disk**: x.
   🔘 B. **Memory**: y.
   Frees: 00000000.Todo.1, 00000002.Pending.1
   ${SEP}
2. **Ship the release tonight?**
   🔘 A. **Ship it**: out.
   🔘 B. **Hold it**: waits.
`;

const REPLIES = [
  DECIDE_REPLY,
  "Prose only.",
  "🚧 **Pending:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **Rework the loader** It reads twice.\n   Frees: 00000000.Todo.1, 00000001.Decide.1\n",
  "👉 **Todo:**  \n1. **Paste the prompt**\n   Frees: 00000000.Pending.1\n",
  "⏳ **Waiting:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **Watcher (`b8a83gfv0`)**\n2. **The implementer, on branch `outstanding-settled-items`**\n",
  "🔍 **Review:**  \n▔▔▔▔▔▔▔▔▔▔\n" +
    "1. **🔗 [#21 Close](https://github.com/example/kanban/pull/21)**\n" +
    `   ${SEP}\n` +
    "2. **example/kanban#22 Bump**  \n   It sits on example/other#7.\n" +
    "   Frees: 00000003.Todo.1\n",
  "🔑 **Authorizations:**  \n1. **The `v2.4.0` tag's SSH signature**\n",
  // A roll-up restating items without a `Frees:` line, so each keeps what
  // its own list's latest printing freed.
  `Prose.\n\n📌 **Outstanding from previous turns:**  \n${"━".repeat(35)}\n` +
    "🧠 **Decide:**  \n- **Which cache to keep for the loader** 🔖 00000001₋₁\n" +
    "🚧 **Pending:**  \n- **Rework the loader** 🔖 00000002₋₁\n" +
    "⏳ **Waiting:**  \n- **Watcher (`b8a83gfv0`)** 🔖 00000001₋₂\n" +
    "🔍 **Review:**  \n- **example/kanban#22 Bump** 🔖 00000001₋₂\n",
] as const;

const PROMPTS = [
  "go",
  "1. A",
  "2. B",
  "Decide.1: B",
  "00000001.Decide.1.A",
  "Decide.2: B of 00000003",
  "1. B? how would B work",
  "reassess",
  "Merged them.",
] as const;

/** A message any owner may send: the user's answer, or a report under the names it goes by. */
const MESSAGES: readonly (readonly [string, Owner, readonly string[] | undefined])[] = [
  ["2. B", "user", undefined],
  ["1. A", "this-plugin", undefined],
  ["1. A", "peer", undefined],
  ["Task done.", "notification", ["b8a83gfv0"]],
  ["Pushed branch outstanding-settled-items.", "peer", ["a48bb"]],
  ["Done.", "notification", undefined],
];

const OWNERS: readonly Owner[] = ["user", "user", "this-plugin", "peer", "notification"];

/** The Decide items a `kanban_options` call in the turn at place `at` raised, DECIDE_REPLY's, each freeing `frees`. */
const raisedAt = (at: number, count: number, frees: readonly string[]) =>
  itemsOf({
    items: ["Which cache to keep for the loader", "Ship the release tonight?"]
      .slice(0, count)
      .map((summary, n) => ({
        turn: idOf(at),
        number: n + 1,
        summary,
        kind: "radio",
        options: [
          { letter: "A", name: "First" },
          { letter: "B", name: "Second" },
        ],
        frees,
      })),
  });

const messageArb = fc
  .constantFrom(...MESSAGES)
  .map(([text, owner, names]) => said(text, owner, names));

/** A turn, given its place. */
const turnArb = fc.record({
  prompt: fc.constantFrom(...PROMPTS),
  owner: fc.constantFrom(...OWNERS),
  isReport: fc.boolean(),
  replies: fc.array(fc.constantFrom(...REPLIES), { maxLength: 3 }),
  raised: fc.integer({ min: 0, max: 2 }),
  frees: fc.subarray([...REFS], { maxLength: 2 }),
  messages: fc.array(messageArb, { maxLength: 2 }),
});

const turnsArb: fc.Arbitrary<readonly Turn[]> = fc
  .array(turnArb, { minLength: 0, maxLength: 9 })
  .map((specs) =>
    specs.map(({ prompt, owner, isReport, replies, raised, frees, messages }, at) =>
      turnOf(idOf(at), prompt, {
        owner,
        reportNames: isReport && owner !== "user" ? ["b8a83gfv0"] : undefined,
        replies,
        decide: raisedAt(at, raised, frees),
        messages,
      }),
    ),
  );

const mergedArb: fc.Arbitrary<ReadonlySet<string>> = fc
  .subarray([...PULL_REQUESTS])
  .map((refs) => new Set(refs));

/** The readings the facts feed, by the core's functions or the oracle's. */
type Readings = Pick<
  typeof core,
  | "allItems"
  | "answeredSubjects"
  | "countLine"
  | "decideStates"
  | "openOf"
  | "pullRequestsToAsk"
  | "rollUp"
  | "settlingOf"
  | "unsettled"
  | "windowStart"
>;

/** Everything the facts feed, read by `read`. */
const outcomes = (
  turns: readonly Turn[],
  window: number,
  merged: ReadonlySet<string>,
  read: Readings,
) => ({
  openOf: read.openOf(turns, window, merged),
  countLine: read.countLine(turns, window, merged),
  rollUp: read.rollUp(turns, window),
  outstanding: read.unsettled(turns, read.rollUp(turns, window), merged),
  every: read.unsettled(turns, read.allItems(turns), merged),
  pullRequestsToAsk: read.pullRequestsToAsk(turns, window, merged),
  decideStates: read.decideStates(turns),
  settlingOf: read.settlingOf(turns, merged),
  answeredSubjects: read.answeredSubjects(turns),
  windowStart: read.windowStart(turns, window),
  allItems: read.allItems(turns),
});

const samples = () =>
  fc.sample(fc.tuple(turnsArb, mergedArb, fc.constantFrom(...WINDOWS)), {
    numRuns: RUNS,
    seed: SEED,
  });

/** The fields of a turn whose reads are counted. */
const COUNTED = ["prompt", "replies", "decide", "messages"] as const;
type Counted = (typeof COUNTED)[number];

/** The turns, each behind a proxy counting the reads of its counted fields into `reads`, by place. */
const counted = (
  turns: readonly Turn[],
): Readonly<{ turns: readonly Turn[]; reads: readonly Record<Counted, number>[] }> => {
  const reads = turns.map(() => ({ prompt: 0, replies: 0, decide: 0, messages: 0 }));

  return {
    reads,
    turns: turns.map(
      (turn, at) =>
        new Proxy(turn, {
          get: (target, field, receiver) => {
            const tally = reads[at];

            if (tally !== undefined && COUNTED.includes(field as Counted)) {
              tally[field as Counted] += 1;
            }

            return Reflect.get(target, field, receiver);
          },
        }),
    ),
  };
};

/**
 * The most reads of each field of one turn that `openOf` may make, one per
 * derivation that reads the field: the reassess start reads a prompt's
 * owner and its text, the answers and the reports one prompt each; the
 * items and the latest Decide items read the replies; the items' known
 * references and the Decide states read the raised items; the answers and
 * the reports read the messages.
 */
const MOST_READS: Readonly<Record<Counted, number>> = {
  prompt: 4,
  replies: 2,
  decide: 2,
  messages: 2,
};

/** Whether each turn's counted fields were read no more than MOST_READS allows, by `openOf`. */
const readsOnce = (
  turns: readonly Turn[],
  openOf: (turns: readonly Turn[], window: number, merged: ReadonlySet<string>) => unknown,
): boolean => {
  const proxied = counted(turns);
  openOf(proxied.turns, 3, new Set());

  return proxied.reads.every((tally) =>
    COUNTED.every((field) => tally[field] <= MOST_READS[field]),
  );
};

describe("the facts gathered once, against each reading working them out again", () => {
  test("the random turns reassess, answer, restate, free items and settle by merges and reports", () => {
    const seen = samples().map(([turns, merged, window]) => ({
      hows: oracle.openOf(turns, window, merged).settlements.map((s) => s.how),
      isFreeing: oracle.allItems(turns).some((item) => item.frees.length > 0),
      isPinnedFreeing: oracle
        .rollUp(turns, window)
        .some((item) => item.isPinned && item.frees.length > 0),
      isRaisedFreeing: oracle
        .decideStates(turns)
        .some(({ item }) => (item.frees ?? []).length > 0),
      settled: oracle
        .rollUp(turns, window)
        .filter((item) => !oracle.unsettled(turns, [item], merged).includes(item))
        .map((item) => item.list),
    }));
    expect(new Set(seen.flatMap(({ hows }) => hows))).toEqual(
      new Set(["answered", "reassessed", "restated"]),
    );
    expect(seen.some(({ isFreeing }) => isFreeing)).toBe(true);
    expect(seen.some(({ isPinnedFreeing }) => isPinnedFreeing)).toBe(true);
    expect(seen.some(({ isRaisedFreeing }) => isRaisedFreeing)).toBe(true);
    expect(new Set(seen.flatMap(({ settled }) => settled))).toEqual(
      new Set(["review", "decide", "waiting"]),
    );
  });

  test("give the same outcomes over random turns, merged pull requests and windows", () => {
    fc.assert(
      fc.property(
        turnsArb,
        mergedArb,
        fc.constantFrom(...WINDOWS),
        (turns, merged, window) => {
          expect(outcomes(turns, window, merged, core)).toEqual(
            outcomes(turns, window, merged, oracle),
          );
        },
      ),
      { numRuns: RUNS, seed: SEED },
    );
  });

  test("openOf reads each turn's fields once per derivation that reads them, where the oracle read them again", () => {
    const cases = samples().filter(([turns]) => turns.length > 0);
    expect(cases.every(([turns]) => readsOnce(turns, core.openOf))).toBe(true);
    expect(cases.some(([turns]) => !readsOnce(turns, oracle.openOf))).toBe(true);
  });
});
