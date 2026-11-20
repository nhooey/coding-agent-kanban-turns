// The table of settlers gives what the chain of `item.list === …` tests it
// replaced gave, test/oracle/settlers.ts: over random neutral turns, with
// random sets of merged pull requests and windows, the items left open of
// the roll-up and of every item, the count line, the pull requests to ask
// GitHub about and what the turns leave open.
//
// Temporary: deleted with the oracle once `settlers-by-list-table` has
// merged into `master`.

import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";

import * as core from "../../../src/items/outstanding.ts";
import type { Owner, Turn } from "../../../types/index.d.ts";
import * as oracle from "../../oracle/settlers.ts";
import { numbered, said, turnOf } from "../../fixtures/turns.ts";

const RUNS = 400;
const SEED = 0x73657474;
const WINDOWS = [0, 1, 3, 20] as const;

const SEP = "⠀";

/** Every pull request a reply below names with its repository. */
const PULL_REQUESTS = [
  "example/kanban#21",
  "example/kanban#22",
  "example/other#7",
] as const;

const DECIDE_REPLY = `Prose.

🧠 **Decide:**
▔▔▔▔▔▔▔▔▔▔
1. **Which cache to keep for the loader**
   🔘 A. **Disk**: x.
   🔘 B. **Memory**: y.
   ${SEP}
2. **Ship the release tonight?**
   🔘 A. **Ship it**: out.
   🔘 B. **Hold it**: waits.
`;

const REPLIES = [
  DECIDE_REPLY,
  "Prose only.",
  "🚧 **Pending:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **Rework the loader** It reads twice.\n",
  "⏳ **Waiting:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **Watcher (`b8a83gfv0`)**\n2. **The implementer, on branch `outstanding-settled-items`**\n",
  "⏳ **Waiting:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **github-config: the two fixes**\n",
  "🔍 **Review:**  \n▔▔▔▔▔▔▔▔▔▔\n" +
    "1. **🔗 [#21 Close](https://github.com/example/kanban/pull/21)**\n" +
    `   ${SEP}\n` +
    "2. **example/kanban#22 Bump**  \n   It sits on example/other#7.\n" +
    `   ${SEP}\n` +
    "3. **#23 The README**\n",
  "🔍 **Review:**  \n▔▔▔▔▔▔▔▔▔▔\n1. **example/other#7 The lock**\n",
  "🔑 **Authorizations:**  \n1. **The `v2.4.0` tag's SSH signature**\n\n👉 **Todo:**  \n1. **Paste the prompt**\n",
  `Prose.\n\n📌 **Outstanding from previous turns:**  \n${"━".repeat(35)}\n` +
    "🧠 **Decide:**  \n- **Which cache to keep for the loader** 🔖 00000001₋₁\n" +
    "⏳ **Waiting:**  \n- **Watcher (`b8a83gfv0`)** 🔖 00000001₋₂\n" +
    "🔍 **Review:**  \n- **example/kanban#22 Bump** 🔖 00000001₋₂\n",
  // Items whose own way leaves them open, each carrying what settles
  // another way: a merged pull request, a reported name and an answered
  // Decide item's subject.
  "🚧 **Pending:**  \n1. **Which cache to keep for the loader, example/kanban#22, Watcher (`b8a83gfv0`)**\n\n" +
    "🔑 **Authorizations:**  \n1. **Which cache to keep for the loader, example/kanban#22, Watcher (`b8a83gfv0`)**\n\n" +
    "👉 **Todo:**  \n1. **Which cache to keep for the loader, example/kanban#22, Watcher (`b8a83gfv0`)**\n",
  "⏳ **Waiting:**  \n1. **Which cache to keep for the loader, example/kanban#22**\n\n" +
    "🔍 **Review:**  \n1. **Which cache to keep for the loader, example/other#9, Watcher (`b8a83gfv0`)**\n\n" +
    "🧠 **Decide:**  \n1. **Ship the release, example/kanban#22, Watcher (`b8a83gfv0`)**\n",
] as const;

const PROMPTS = [
  "go",
  "1. A",
  "2. B",
  "Decide.1: B",
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
  ["Done.", "peer", ["github-config"]],
  ["Done.", "notification", undefined],
];

const OWNERS: readonly Owner[] = ["user", "this-plugin", "peer", "notification"];

const messageArb = fc
  .constantFrom(...MESSAGES)
  .map(([text, owner, names]) => said(text, owner, names));

const turnArb: fc.Arbitrary<Turn> = fc
  .record({
    prompt: fc.constantFrom(...PROMPTS),
    owner: fc.constantFrom(...OWNERS),
    isReport: fc.boolean(),
    replies: fc.array(fc.constantFrom(...REPLIES), { maxLength: 3 }),
    messages: fc.array(messageArb, { maxLength: 2 }),
  })
  .map(({ prompt, owner, isReport, replies, messages }) =>
    turnOf("", prompt, {
      owner,
      reportNames: isReport && owner !== "user" ? ["b8a83gfv0"] : undefined,
      replies,
      messages,
    }),
  );

const turnsArb: fc.Arbitrary<readonly Turn[]> = fc
  .array(turnArb, { minLength: 1, maxLength: 8 })
  .map(numbered);

const mergedArb: fc.Arbitrary<ReadonlySet<string>> = fc
  .subarray([...PULL_REQUESTS])
  .map((refs) => new Set(refs));

/** Everything the settling reads, by the core's functions or the oracle's. */
const outcomes = (
  turns: readonly Turn[],
  window: number,
  merged: ReadonlySet<string>,
  read: Pick<
    typeof core,
    "unsettled" | "pullRequestsToAsk" | "countLine" | "openOf"
  > &
    Readonly<{ askAbout: (items: readonly core.ListItem[]) => readonly string[] }>,
) => ({
  rolledUp: read.unsettled(turns, core.rollUp(turns, window), merged),
  every: read.unsettled(turns, core.allItems(turns), merged),
  askAbout: read.askAbout(core.allItems(turns)),
  pullRequestsToAsk: read.pullRequestsToAsk(turns, window, merged),
  countLine: read.countLine(turns, window, merged),
  openOf: read.openOf(turns, window, merged),
});

/** The lists whose items, of every item, `merged` settles. */
const settledLists = (turns: readonly Turn[], merged: ReadonlySet<string>) => {
  const items = core.allItems(turns);
  const open = core.unsettled(turns, items, merged);

  return items.filter((item) => !open.includes(item)).map((item) => item.list);
};

/**
 * The lists of the items, of every item, that stay open though another
 * way's settler would settle them: a fact that settles some other list's
 * item is there for them, and their own way ignores it.
 */
const openDespite = (turns: readonly Turn[], merged: ReadonlySet<string>) => {
  const settling = core.settlingOf(turns, merged);
  const settlers = Object.values(core.SETTLERS);

  return core
    .unsettled(turns, core.allItems(turns), merged)
    .filter((item) =>
      settlers.some(
        (settler) => settler !== core.settlerOf(item) && settler.settles(item, settling),
      ),
    )
    .map((item) => item.list);
};

describe("the table of settlers, against the chain it replaced", () => {
  test("the random turns settle a Review, a Decide and a Waiting item, and leave each open", () => {
    const samples = fc.sample(fc.tuple(turnsArb, mergedArb), { numRuns: RUNS, seed: SEED });
    const settled = new Set(samples.flatMap(([turns, merged]) => settledLists(turns, merged)));
    const open = new Set(
      samples.flatMap(([turns, merged]) =>
        core.unsettled(turns, core.allItems(turns), merged).map((item) => item.list),
      ),
    );
    expect(settled).toEqual(new Set(["review", "decide", "waiting"]));
    expect(open).toEqual(new Set(core.LIST_KEYS));
  });

  test("the random turns leave an item of every list open, though another way's fact would settle it", () => {
    const samples = fc.sample(fc.tuple(turnsArb, mergedArb), { numRuns: RUNS, seed: SEED });
    expect(
      new Set(samples.flatMap(([turns, merged]) => openDespite(turns, merged))),
    ).toEqual(new Set(core.LIST_KEYS));
  });

  test("give the same outcomes over random turns, merged pull requests and windows", () => {
    fc.assert(
      fc.property(
        turnsArb,
        mergedArb,
        fc.constantFrom(...WINDOWS),
        (turns, merged, window) => {
          expect(
            outcomes(turns, window, merged, { ...core, askAbout: core.settlingPullRequests }),
          ).toEqual(
            outcomes(turns, window, merged, { ...oracle, askAbout: oracle.reviewPullRequests }),
          );
        },
      ),
      { numRuns: RUNS, seed: SEED },
    );
  });
});
