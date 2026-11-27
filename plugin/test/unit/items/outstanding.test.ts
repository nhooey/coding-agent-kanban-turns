// What earlier turns left open: the kanban skill's test_outstanding.py, on
// neutral turns built directly, with the Decide items raised by the turns'
// `kanban_options` calls; and what settles each list's items.

import { describe, mock, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";
import { readFileSync } from "node:fs";

import {
  LIST_KEYS,
  SETTLERS,
  allItems,
  answeredSubjects,
  answersOfLine,
  countLine,
  decideItemsOfText,
  decideStates,
  factsOf,
  isMergeKnown,
  itemsOfText,
  listItemRef,
  mergedOfResponse,
  mergedQuery,
  openDecideItems,
  openItemsIn,
  openOf,
  pullRequestsOf,
  pullRequestsToAsk,
  rollUp,
  settlementsIn,
  settlementsOf,
  settlerOf,
  settlingOf,
  subjectKey,
  summaryOf,
  supersedersOf,
  unsettled,
  windowStart,
  withRepliedFrees,
  withResolvedFrees,
} from "../../../src/items/outstanding.ts";
import type { ListItem, ListKey, Settling } from "../../../src/items/outstanding.ts";
import { itemsOf, reraisable } from "../../../src/items/items.ts";
import { parseYaml } from "../../../src/config/config.ts";
import { field } from "../../../src/json/fields.ts";
import type { Owner, Turn } from "../../../types/index.d.ts";
import { numbered, said, turnOf } from "../../fixtures/turns.ts";

const SEP = "⠀";
const RULE = "━".repeat(35);
const FIRST = "9efb08a1";
const SECOND = "b2c3d4e5";
const THIRD = "c3d4e5f6";
const FOURTH = "d4e5f6a7";
const WINDOW = 20;

/** One turn of the user's: its id, its prompt, and its replies. */
const turn = (id: string, text: string, ...replies: readonly string[]): Turn =>
  turnOf(id, text, { replies });

/** One turn a peer's report opened, which is no text of the user's. */
const report = (
  id: string,
  text: string,
  reportNames: readonly string[] | undefined,
  ...replies: readonly string[]
): Turn => turnOf(id, text, { owner: "peer", reportNames, replies });

/** One turn whose reply raised `call`'s items, its prompt written by `owner`. */
const later = (id: string, text: string, call: unknown, owner: Owner = "user"): Turn =>
  turnOf(id, text, { owner, replies: ["later"], decide: itemsOf(call) });

const DECIDE_REPLY = `Opening prose.

🧠 **Decide:**
▔▔▔▔▔▔▔▔▔▔
1. **Which cache to keep for the loader**
   A note on the whole item.
   🔘 A. **Keep the disk cache**: it survives restarts.
      ➕ Faster cold starts.
      ➖ Disk use.
   🔘 B. **Keep the memory cache**: simpler.
      ➕ Less code.
      ➖ Slow cold starts.
   ${SEP}
2. **Backlog cleanups to start**
   Any of 3.
   🔲 A. **Entry 1411, the matchers made one**: one function.
      ➕ One behaviour.
      ➖ Tokens.
   🔲 B. **Entries 0550 and 0455, dead code**: delete it.
      ➕ Cheap.
      ➖ Tidiness only.
   ${SEP}
3. **Ship the release tonight?**
   🔘 A. **Ship it**: it goes out.
      ➕ Users get it.
      ➖ Risk.
   🔘 B. **Hold it**: it waits.
      ➕ Safety.
      ➖ Delay.

📌 **Outstanding from previous turns:**
${RULE}
🧠 **Decide:**
- **An older decision** 🔖 0000aaaa₋₃
`;

const SUMMARIES = [
  "Which cache to keep for the loader",
  "Backlog cleanups to start",
  "Ship the release tonight?",
];

/** A kanban_options call raising the items numbered `numbers`, by DECIDE_REPLY's summaries. */
const decideCall = (
  id: string,
  numbers: readonly number[] = [1, 2, 3],
  summaries: readonly string[] = SUMMARIES,
) => ({
  items: numbers.map((number, n) => ({
    turn: id,
    number,
    summary: summaries[n] ?? "",
    kind: "radio",
    options: [
      { letter: "A", name: "First" },
      { letter: "B", name: "Second" },
    ],
  })),
});

/** The user's turn `id` whose reply prints DECIDE_REPLY and raises its items. */
const decided = (id: string, text = "go"): Turn =>
  turnOf(id, text, { replies: [DECIDE_REPLY], decide: itemsOf(decideCall(id)) });

const openRefs = (turns: readonly Turn[]) =>
  openDecideItems(numbered(turns)).map((item) => item.ref);

describe("openDecideItems", () => {
  test("every item the last reply's call raised is open", () => {
    expect(openRefs([decided(FIRST)])).toEqual([
      "9efb08a1.Decide.1",
      "9efb08a1.Decide.2",
      "9efb08a1.Decide.3",
    ]);
  });

  test("an answer naming the turn settles its item", () => {
    expect(
      openRefs([decided(FIRST), turn("", "9efb08a.Decide.1.A 9efb08a1.Decide.2: A,C")]),
    ).toEqual(["9efb08a1.Decide.3"]);
  });

  test("an answer with the turn after it settles its item", () => {
    expect(openRefs([decided(FIRST), turn("", "Decide.3.B of 9efb08a1")])).toEqual([
      "9efb08a1.Decide.1",
      "9efb08a1.Decide.2",
    ]);
  });

  test("a bare answer settles the turn before it", () => {
    expect(openRefs([decided(FIRST), turn("", "Decide.1: B\n3. A")])).toEqual([
      "9efb08a1.Decide.2",
    ]);
  });

  test("a bare answer two turns later settles nothing of the first", () => {
    expect(
      openRefs([decided(FIRST), turn("", "something else", "Done."), turn("", "Decide.1.A")]),
    ).toEqual(["9efb08a1.Decide.1", "9efb08a1.Decide.2", "9efb08a1.Decide.3"]);
  });

  test("a bare answer means the turn right before it, a report's turn too", () => {
    expect(
      openRefs([
        decided(FIRST),
        turnOf("", "<task-notification>done</task-notification>", { owner: "notification" }),
        turn("", "Decide.1.A"),
      ]),
    ).toEqual(["9efb08a1.Decide.1", "9efb08a1.Decide.2", "9efb08a1.Decide.3"]);
  });

  test("an answer sent while a turn ran settles its item", () => {
    expect(
      openRefs([decided(FIRST), turnOf("", "something else", { messages: [said("Decide.2.B")] })]),
    ).toEqual(["9efb08a1.Decide.1", "9efb08a1.Decide.3"]);
  });

  test("an answer in words settles its item, and a note keeps the letters", () => {
    expect(
      openRefs([
        decided(FIRST),
        turn("", "9efb08a1.Decide.1: A red one, please\n9efb08a1.Decide.3.B: not tonight"),
      ]),
    ).toEqual(["9efb08a1.Decide.2"]);
  });

  test("a reference alone answers nothing", () => {
    expect(openRefs([decided(FIRST), turn("", "see 9efb08a1.Decide.1 again")])).toContain(
      "9efb08a1.Decide.1",
    );
  });

  test("a question answers nothing", () => {
    expect(
      openRefs([decided(FIRST), turn("", "9efb08a1.Decide.1.B? how would B work")]),
    ).toContain("9efb08a1.Decide.1");
  });

  test("only the user's own text answers", () => {
    const answers = "1. A\n9efb08a1.Decide.2.B";
    for (const after of [
      [
        turn("", "more"),
        turnOf("", `<agent-message from="a48bb9142825233bb">\n${answers}\n</agent-message>`, { owner: "peer" }),
      ],
      [
        turn("", "more"),
        turnOf(
          "",
          `Another Claude session sent a message:\n<cross-session-message from="uds:/tmp/x.sock" from-name="x">\n${answers}\n</cross-session-message>`,
          { owner: "peer" },
        ),
      ],
      [
        turn("", "more"),
        turnOf("", `<task-notification>\n<summary>\n${answers}\n</summary>\n</task-notification>`, {
          owner: "notification",
        }),
      ],
      [turn("", "more"), turnOf("", answers, { owner: "other-plugin" })],
      [turn("", "more"), turnOf("", answers, { owner: "scheduled" })],
      [turnOf("", "more", { messages: [said(answers, "peer")] })],
      [turnOf("", "more", { messages: [said(answers, "notification")] })],
    ]) {
      expect(openRefs([decided(FIRST), ...after])).toEqual([
        "9efb08a1.Decide.1",
        "9efb08a1.Decide.2",
        "9efb08a1.Decide.3",
      ]);
    }
    expect(openRefs([decided(FIRST), turn("", "1. A\n9efb08a1.Decide.2.B")])).toEqual([
      "9efb08a1.Decide.3",
    ]);
  });

  test("the line naming the plugin that opens a clicked draft answers nothing, and the answers under it do", () => {
    for (const header of ["coding-agent-kanban-turns@nix-pinned:", "coding-agent-kanban-turns:"]) {
      expect(
        openRefs([decided(FIRST), turn("", `${header}\n9efb08a1.Decide.1.A\n3. Y`)]),
      ).toEqual(["9efb08a1.Decide.2"]);
      expect(
        openRefs([decided(FIRST, "more"), turnOf("", "on it", { messages: [said(`${header}\n1. A`)] })]),
      ).toEqual(["9efb08a1.Decide.2", "9efb08a1.Decide.3"]);
    }
  });

  test("a draft the pane's Submit sent is the user's own text, and answers", () => {
    expect(
      openRefs([
        decided(FIRST),
        turnOf("", "9efb08a1.Decide.1.A\n9efb08a1.Decide.2.B: only the loader", {
          owner: "this-plugin",
        }),
      ]),
    ).toEqual(["9efb08a1.Decide.3"]);
  });

  test("a restated item is open once, under its latest turn", () => {
    expect(
      openRefs([
        decided(FIRST),
        turnOf(SECOND, "more", {
          replies: ["restated"],
          decide: itemsOf(decideCall(SECOND, [4], SUMMARIES.slice(0, 1))),
        }),
      ]),
    ).toEqual(["9efb08a1.Decide.2", "9efb08a1.Decide.3", "b2c3d4e5.Decide.4"]);
  });

  test("a reassess turn replaces every earlier item", () => {
    for (const name of ["reassess", "recheck", "regenerate", "recalculate", "regen", "recalc", "reass"]) {
      expect(
        openRefs([decided(FIRST), later(SECOND, name, decideCall(SECOND, [1], SUMMARIES.slice(0, 1)))]),
      ).toEqual(["b2c3d4e5.Decide.1"]);
    }
  });

  test("the Reassess button's prompt replaces every earlier item too", () => {
    expect(
      openRefs([
        decided(FIRST),
        later(SECOND, "reassess", decideCall(SECOND, [1], SUMMARIES.slice(0, 1)), "this-plugin"),
      ]),
    ).toEqual(["b2c3d4e5.Decide.1"]);
  });

  test("another session's, an agent's or a task's message opening on Recheck replaces nothing, nor another plugin's prompt", () => {
    for (const [text, owner] of [
      ["Recheck the build when you can.", "peer"],
      ["recheck", "peer"],
      ["Recheck: the watcher fired", "notification"],
      ["reassess", "other-plugin"],
      ["reassess", "scheduled"],
    ] as const) {
      expect(
        openRefs([decided(FIRST), later("", text, decideCall(SECOND, [4], SUMMARIES.slice(0, 1)), owner)]),
      ).toEqual(["9efb08a1.Decide.2", "9efb08a1.Decide.3", "b2c3d4e5.Decide.4"]);
    }
  });

  test("the slash command form of reassess", () => {
    expect(
      openRefs([
        decided(FIRST),
        later(SECOND, "/coding-agent-kanban-turn-responses recheck", decideCall(SECOND, [1], SUMMARIES.slice(0, 1))),
      ]),
    ).toEqual(["b2c3d4e5.Decide.1"]);
  });

  test("an open turn replaces nothing", () => {
    expect(
      openRefs([decided(FIRST), later(SECOND, "restate", decideCall(SECOND, [4], SUMMARIES.slice(0, 1)))]),
    ).toEqual(["9efb08a1.Decide.2", "9efb08a1.Decide.3", "b2c3d4e5.Decide.4"]);
  });

  test("a reassess grouped by topic numbers on across topics", () => {
    const grouped = turnOf(SECOND, "reassess", {
      replies: ["grouped"],
      decide: itemsOf(decideCall(SECOND, [1, 2], ["Merge order for the swap", "Snapshot retention"])),
    });
    const rows = [decided(FIRST), grouped];
    expect(openRefs(rows)).toEqual(["b2c3d4e5.Decide.1", "b2c3d4e5.Decide.2"]);
    expect(openRefs([...rows, turn("", "Decide.2: B")])).toEqual(["b2c3d4e5.Decide.1"]);
  });

  test("a prompt that gives answers and ends on a reassess line applies them, then reassesses", () => {
    for (const last of ["reassess", "Recheck.", "regen", "  reassess  "]) {
      const rows = [
        decided(FIRST),
        later(
          SECOND,
          `coding-agent-kanban-turns:\n9efb08a1.Decide.1.A\n${last}\n`,
          decideCall(SECOND, [1], ["Merge order for the swap"]),
          "this-plugin",
        ),
      ];
      expect(openRefs(rows)).toEqual(["b2c3d4e5.Decide.1"]);
      expect(settlementsOf(rows)).toEqual([
        { ref: "9efb08a1.Decide.1", how: "answered", turn: SECOND, letters: ["A"], note: "" },
        { ref: "9efb08a1.Decide.2", how: "reassessed" },
        { ref: "9efb08a1.Decide.3", how: "reassessed" },
      ]);
    }
  });

  test("answers then a trailing reassess: answer, and then reassess, typed or submitted", () => {
    for (const owner of ["user", "this-plugin"] as const) {
      const rows = [
        decided(FIRST),
        later(SECOND, "1. A / 3. Y\nreassess", decideCall(SECOND, [1], ["Merge order for the swap"]), owner),
      ];
      expect(openRefs(rows)).toEqual(["b2c3d4e5.Decide.1"]);
      expect(settlementsOf(rows).map((s) => [s.ref, s.how])).toEqual([
        ["9efb08a1.Decide.1", "answered"],
        ["9efb08a1.Decide.2", "reassessed"],
        ["9efb08a1.Decide.3", "answered"],
      ]);
    }
  });

  test("a trailing reassess runs without answers too", () => {
    for (const text of ["Look at the build again.\nreassess", "The agent reported.\n\nrecheck.\n"]) {
      expect(
        openRefs([decided(FIRST), later(SECOND, text, decideCall(SECOND, [1], ["Merge order for the swap"]))]),
      ).toEqual(["b2c3d4e5.Decide.1"]);
    }
  });

  test("a trailing open or another plugin's trailing reassess runs nothing", () => {
    for (const [text, owner] of [
      ["Look at the build again.\nopen", "user"],
      ["1. A\nreassess", "other-plugin"],
    ] as const) {
      expect(
        openRefs([decided(FIRST), later(SECOND, text, decideCall(SECOND, [4], SUMMARIES.slice(0, 1)), owner)]),
      ).toEqual(["9efb08a1.Decide.2", "9efb08a1.Decide.3", "b2c3d4e5.Decide.4"]);
    }
  });

  test("the pane's header line is neither an answer nor a command", () => {
    for (const header of ["coding-agent-kanban-turns@nix-pinned:", "coding-agent-kanban-turns:"]) {
      expect(
        openRefs([decided(FIRST), turnOf(SECOND, `${header}\n2. B`, { owner: "this-plugin" })]),
      ).toEqual(["9efb08a1.Decide.1", "9efb08a1.Decide.3"]);
      expect(
        openRefs([
          decided(FIRST),
          later(SECOND, `${header}\nreassess`, decideCall(SECOND, [1], ["Merge order for the swap"]), "this-plugin"),
        ]),
      ).toEqual(["b2c3d4e5.Decide.1"]);
    }
  });

  test("a last line that only mentions reassess, or names another command, reassesses nothing", () => {
    for (const last of ["please reassess", "reassess?", "restate", "re"]) {
      expect(
        openRefs([
          decided(FIRST),
          later(SECOND, `9efb08a1.Decide.1.A\n${last}`, decideCall(SECOND, [4], ["Merge order for the swap"])),
        ]),
      ).toEqual(["9efb08a1.Decide.2", "9efb08a1.Decide.3", "b2c3d4e5.Decide.4"]);
    }
  });
});

describe("how a Decide item settled", () => {
  test("the answer that settled it: its letters, its note, and the turn it was sent in, the latest when answered again", () => {
    const rows = [
      decided(FIRST),
      turn(SECOND, "9efb08a1.Decide.1.A\n9efb08a1.Decide.2: not yet"),
      turn(THIRD, "9efb08a1.Decide.1.B: only for the loader"),
    ];
    expect(settlementsOf(rows)).toEqual([
      { ref: "9efb08a1.Decide.1", how: "answered", turn: THIRD, letters: ["B"], note: "only for the loader" },
      { ref: "9efb08a1.Decide.2", how: "answered", turn: SECOND, letters: [], note: "not yet" },
    ]);
  });

  test("an item a later one on its subject restates, giving no supersedes, is superseded by it", () => {
    expect(
      settlementsOf([
        decided(FIRST),
        turnOf(SECOND, "more", {
          replies: ["restated"],
          decide: itemsOf(decideCall(SECOND, [4], SUMMARIES.slice(0, 1))),
        }),
      ]),
    ).toEqual([{ ref: "9efb08a1.Decide.1", how: "superseded", by: "b2c3d4e5.Decide.4" }]);
  });

  test("an open item has none", () => {
    expect(settlementsOf([decided(FIRST)])).toEqual([]);
  });
});

/** A turn whose reply raised one item, numbered `number` and summarised `summary`, superseding `supersedes` where given. */
const raising = (
  id: string,
  number: number,
  summary: string,
  supersedes?: readonly unknown[],
): Turn =>
  turnOf(id, "more", {
    replies: ["restated"],
    decide: itemsOf({
      items: decideCall(id, [number], [summary]).items.map((item) =>
        supersedes === undefined ? item : { ...item, supersedes },
      ),
    }),
  });

describe("a Decide item superseded by a later one", () => {
  test("is the one a later item names in supersedes, whatever its subject, the newer item open", () => {
    const rows = [decided(FIRST), raising(SECOND, 1, "Which loader to keep", ["9efb08a1.Decide.2"])];
    expect(settlementsOf(rows)).toEqual([{ ref: "9efb08a1.Decide.2", how: "superseded", by: "b2c3d4e5.Decide.1" }]);
    expect(openRefs(rows)).toEqual(["9efb08a1.Decide.1", "9efb08a1.Decide.3", "b2c3d4e5.Decide.1"]);
  });

  test("an explicit supersedes wins over the subject: an item on the same subject it doesn't name stays open", () => {
    const rows = [decided(FIRST), raising(SECOND, 1, SUMMARIES[0] ?? "", ["9efb08a1.Decide.3"])];
    expect(settlementsOf(rows)).toEqual([{ ref: "9efb08a1.Decide.3", how: "superseded", by: "b2c3d4e5.Decide.1" }]);
    expect(openRefs(rows)).toEqual(["9efb08a1.Decide.1", "9efb08a1.Decide.2", "b2c3d4e5.Decide.1"]);
  });

  test("an empty supersedes replaces none, not even an item on its subject", () => {
    const rows = [decided(FIRST), raising(SECOND, 1, SUMMARIES[0] ?? "", [])];
    expect(settlementsOf(rows)).toEqual([]);
  });

  test("names the latest later item that named it, over a later one on its subject that named nothing", () => {
    const rows = [
      decided(FIRST),
      raising(SECOND, 1, "Which loader to keep", ["9efb08a1.Decide.1"]),
      raising(THIRD, 1, SUMMARIES[0] ?? ""),
    ];
    expect(settlementsOf(rows)[0]).toEqual({ ref: "9efb08a1.Decide.1", how: "superseded", by: "b2c3d4e5.Decide.1" });
  });

  test("names the latest of two later items that both named it", () => {
    const rows = [
      decided(FIRST),
      raising(SECOND, 1, "Which loader to keep", ["9efb08a1.Decide.1"]),
      raising(THIRD, 1, "Which renderer to keep", ["9efb08a1.Decide.1"]),
    ];
    expect(settlementsOf(rows)).toEqual([{ ref: "9efb08a1.Decide.1", how: "superseded", by: "c3d4e5f6.Decide.1" }]);
    expect(openRefs(rows)).toEqual(["9efb08a1.Decide.2", "9efb08a1.Decide.3", "b2c3d4e5.Decide.1", "c3d4e5f6.Decide.1"]);
  });

  test("an open item raised again from kanban_outstanding's items is listed once, with its supersedes or without", () => {
    const rows = [decided(FIRST), raising(SECOND, 1, "Which loader to keep", ["9efb08a1.Decide.2"])];
    const handed = JSON.parse(JSON.stringify({ items: openOf(numbered(rows), WINDOW).items.map(reraisable) }));
    const kept = JSON.parse(JSON.stringify({ items: openOf(numbered(rows), WINDOW).items }));
    const once = ["9efb08a1.Decide.1", "9efb08a1.Decide.3", "b2c3d4e5.Decide.1"];

    expect(handed.items.some((item: object) => "supersedes" in item)).toBe(false);
    for (const input of [handed, kept]) {
      const again = [...rows, turnOf(THIRD, "go on", { replies: ["again"], decide: itemsOf(input) })];
      expect(openRefs(again)).toEqual(once);
      expect(openRefs([...again, turnOf(FOURTH, "go on", { replies: ["again"], decide: itemsOf(input) })])).toEqual(once);
    }
  });

  test("an earlier raising of an item goes as its latest raising goes, by what replaced that one", () => {
    const rows = [
      decided(FIRST),
      raising(SECOND, 1, "Which loader to keep", []),
      raising(SECOND, 1, "Which loader to keep", []),
      raising(THIRD, 1, "Which renderer to keep", ["b2c3d4e5.Decide.1"]),
    ];
    expect(settlementsOf(rows).filter((s) => s.ref === "b2c3d4e5.Decide.1")).toEqual([
      { ref: "b2c3d4e5.Decide.1", how: "superseded", by: "c3d4e5f6.Decide.1" },
      { ref: "b2c3d4e5.Decide.1", how: "superseded", by: "c3d4e5f6.Decide.1" },
    ]);
  });

  test("an item a turn's second call raises again, naming another item the second time, is listed once", () => {
    const call = (supersedes: readonly string[]) => ({
      items: decideCall(SECOND, [1], ["Which loader to keep"]).items.map((item) => ({ ...item, supersedes })),
    });
    const rows = [
      decided(FIRST),
      turnOf(SECOND, "more", {
        replies: ["restated"],
        decide: [...itemsOf(call([])), ...itemsOf(call(["9efb08a1.Decide.2"]))],
      }),
    ];
    expect(openRefs(rows)).toEqual(["9efb08a1.Decide.1", "9efb08a1.Decide.3", "b2c3d4e5.Decide.1"]);
    expect(settlementsOf(rows)).toEqual([
      { ref: "9efb08a1.Decide.2", how: "superseded", by: "b2c3d4e5.Decide.1" },
      { ref: "b2c3d4e5.Decide.1", how: "superseded", by: "b2c3d4e5.Decide.1" },
    ]);
  });

  test("one item supersedes several, by a turn id's prefix too, each once", () => {
    const rows = [
      decided(FIRST),
      raising(SECOND, 1, "Which loader to keep", ["9efb08a1.Decide.1", "9efb08.Decide.2", " 9efb08a1.Decide.1 "]),
    ];
    expect(settlementsOf(rows)).toEqual([
      { ref: "9efb08a1.Decide.1", how: "superseded", by: "b2c3d4e5.Decide.1" },
      { ref: "9efb08a1.Decide.2", how: "superseded", by: "b2c3d4e5.Decide.1" },
    ]);
    expect(decideStates(numbered(rows)).at(-1)?.item.supersedes).toEqual(["9efb08a1.Decide.1", "9efb08.Decide.2"]);
  });

  test("a reference that names no Decide item, a later one, an unknown one or the item itself supersedes nothing", () => {
    const rows = [
      decided(FIRST),
      raising(SECOND, 1, "Which loader to keep", [
        "Decide.1",
        "9efb08a1.Todo.2",
        "9efb08a1.Decide.x",
        3,
        "c3d4e5f6.Decide.1",
        "9efb08a1.Decide.9",
        "b2c3d4e5.Decide.1",
      ]),
      raising(THIRD, 1, "Which renderer to keep"),
    ];
    expect(settlementsOf(rows)).toEqual([]);
    expect(decideStates(numbered(rows))[3]?.item.supersedes).toEqual([
      "c3d4e5f6.Decide.1",
      "9efb08a1.Decide.9",
      "b2c3d4e5.Decide.1",
    ]);
  });

  test("a cycle settles only the older item: one naming a later item supersedes nothing", () => {
    const rows = [
      raising(FIRST, 1, "Which cache to keep", ["b2c3d4e5.Decide.1"]),
      raising(SECOND, 1, "Which loader to keep", ["9efb08a1.Decide.1"]),
    ];
    expect(settlementsOf(rows)).toEqual([{ ref: "9efb08a1.Decide.1", how: "superseded", by: "b2c3d4e5.Decide.1" }]);
    expect(openRefs(rows)).toEqual(["b2c3d4e5.Decide.1"]);
  });

  test("an answer to it settles it as answered all the same", () => {
    const rows = [
      decided(FIRST),
      turnOf(SECOND, "9efb08a1.Decide.2.A", {
        replies: ["restated"],
        decide: itemsOf({
          items: decideCall(SECOND, [1], ["Which loader to keep"]).items.map((item) => ({
            ...item,
            supersedes: ["9efb08a1.Decide.2"],
          })),
        }),
      }),
    ];
    expect(settlementsOf(rows)).toEqual([
      { ref: "9efb08a1.Decide.2", how: "answered", turn: SECOND, letters: ["A"], note: "" },
    ]);
  });

  test("a reassess between them settles it as reassessed, before any supersedes", () => {
    const rows = [
      decided(FIRST),
      turnOf(SECOND, "reassess", {
        replies: ["restated"],
        decide: itemsOf({
          items: decideCall(SECOND, [1], ["Which loader to keep"]).items.map((item) => ({
            ...item,
            supersedes: ["9efb08a1.Decide.2"],
          })),
        }),
      }),
    ];
    expect(settlementsOf(rows).map((s) => s.how)).toEqual(["reassessed", "reassessed", "reassessed"]);
  });
});

describe("supersedersOf", () => {
  const at = (item: unknown, place: number) => ({ item: itemsOf({ items: [item] })[0]!, at: place });
  const item = (turn: string, number: number, summary: string, supersedes?: readonly string[]) => ({
    ...decideCall(turn, [number], [summary]).items[0],
    ...(supersedes === undefined ? {} : { supersedes }),
  });

  test("is the latest later item naming it, else the latest later one on its subject naming nothing, else none", () => {
    const raised = [
      at(item(FIRST, 1, "Which cache to keep"), 0),
      at(item(SECOND, 1, "Which cache to keep"), 1),
      at(item(THIRD, 1, "Which loader to keep", ["9efb08a1.Decide.1"]), 2),
      at(item(FOURTH, 1, "Which cache to keep", ["b2c3d4e5.Decide.1"]), 3),
    ];
    expect(supersedersOf(raised)).toEqual([
      "c3d4e5f6.Decide.1",
      "d4e5f6a7.Decide.1",
      undefined,
      undefined,
    ]);
    expect(supersedersOf([])).toEqual([]);
  });
});

describe("answersOfLine", () => {
  test("an answer naming its turn after it answers no item of the turn before", () => {
    for (const [line, letters] of [
      ["Decide.2: B of 9efb08a1", ["B"]],
      ["Decide.2: B,C of 9efb08a1", ["B", "C"]],
      ["Decide.2.A, C from 9efb08a1", ["A", "C"]],
    ] as const) {
      expect(answersOfLine(line)).toEqual([{ turn: "9efb08a1", number: 2, letters, note: "" }]);
    }
  });

  test("an answer to the turn before names no turn", () => {
    expect(answersOfLine("Decide.1: B")).toEqual([{ turn: "", number: 1, letters: ["B"], note: "" }]);
    expect(answersOfLine("2. A, C")).toEqual([{ turn: "", number: 2, letters: ["A", "C"], note: "" }]);
  });

  test("an answer's letters and its note are read with it", () => {
    expect(answersOfLine("9efb08a1.Decide.1.B: only for the loader")).toEqual([
      { turn: "9efb08a1", number: 1, letters: ["B"], note: "only for the loader" },
    ]);
    expect(answersOfLine("9efb08a1.Decide.2: I'd rather wait")).toEqual([
      { turn: "9efb08a1", number: 2, letters: [], note: "I'd rather wait" },
    ]);
    expect(answersOfLine("Decide.3.Y")).toEqual([{ turn: "", number: 3, letters: ["Y"], note: "" }]);
  });

  test("prose opening on a number answers nothing", () => {
    expect(answersOfLine("2. A bigger cache would help")).toEqual([]);
  });
});

describe("decideItemsOfText", () => {
  test("each numbered item with options is read, the roll-up's bullets not", () => {
    expect(decideItemsOfText(DECIDE_REPLY)).toEqual(
      SUMMARIES.map((summary, n) => ({ number: n + 1, summary })),
    );
  });

  test("an item without options is left out", () => {
    const text =
      "🧠 **Decide:**  \n▔▔▔▔▔▔▔▔▔▔\n1. **Something to think about**  \n   No options here.\n";
    expect(decideItemsOfText(text)).toEqual([]);
  });
});

// A header or a summary alone on its line ends in a hard line break, two spaces.
const BR = "  ";
const ITEMS_REPLY = `Prose.

🚧 **Pending:**${BR}
▔▔▔▔▔▔▔▔▔▔▔
1. **Rework the loader**${BR}
   It still reads twice.
   ${SEP}
2. **Another one**: with its text beside it

✅ **Done:**${BR}
1. **Not an item of any rolled-up list**

📌 **Outstanding from previous turns:**${BR}
${RULE}
👉 **Todo:**${BR}
- **Paste the prompt** 🔖 b2c3d4e5₋₁
`;

describe("itemsOfText", () => {
  test("the items of the rolled-up lists and of the 📌 roll-up, the roll-up's tag cut off and the turn it names kept", () => {
    expect(itemsOfText(ITEMS_REPLY)).toEqual([
      { list: "pending", number: 1, isPinned: false, line: "**Rework the loader** It still reads twice.", frees: [] },
      { list: "pending", number: 2, isPinned: false, line: "**Another one**: with its text beside it", frees: [] },
      { list: "todo", number: undefined, isPinned: true, line: "**Paste the prompt**", frees: [], tagged: "b2c3d4e5" },
    ]);
  });

  test("an item with no 🔖 tag has no tagged turn", () => {
    expect(itemsOfText(ITEMS_REPLY)[0]).not.toHaveProperty("tagged");
  });

  test("a topic header is no part of the item above", () => {
    const text =
      "**First topic**  \n═══════════\n👉 **Todo:**  \n▔▔▔▔▔▔▔▔\n1. **Run the benchmark**\n\n**Second topic**  \n════════════\n";
    expect(itemsOfText(text)).toEqual([
      { list: "todo", number: 1, isPinned: false, line: "**Run the benchmark**", frees: [] },
    ]);
  });

  test("an older roll-up header and a list alias still read", () => {
    const text = "Still open from earlier\n📋 **To review:**  \n- **The README** 🔖 b2c3d4e5₋₁\n";
    expect(itemsOfText(text).map((item) => item.list)).toEqual(["review"]);
  });

  test("every turn's items carry the turn's place", () => {
    const found = allItems(numbered([turn("", "go", ITEMS_REPLY), turn("", "more", ITEMS_REPLY)]));
    expect(found.map((item) => item.at)).toEqual([0, 0, 0, 1, 1, 1]);
  });
});

const FREES_REPLY = `Prose.

👉 **Todo:**${BR}
▔▔▔▔▔▔▔▔
1. **Paste the release prompt**${BR}
   Frees: ${FIRST}.Decide.1, ${FIRST}.Review.1
   ${SEP}
2. **Run the benchmark**${BR}
   Frees: ${FIRST}.Todo.1
   It takes 4 minutes.
   ${SEP}
3. **Mark up the plan**

🧠 **Decide:**${BR}
▔▔▔▔▔▔▔▔▔▔
1. **Which cache to keep**${BR}
   🔘 A. **Keep it**: nothing moves.
      ➕ Cheap.
      ➖ Slow.
   Frees: ${FIRST}.Todo.3
`;

describe("what an item frees", () => {
  test("is its last line's references, as written", () => {
    expect(
      itemsOfText(FREES_REPLY).map(({ list, number, frees }) => ({ list, number, frees })),
    ).toEqual([
      { list: "todo", number: 1, frees: [`${FIRST}.Decide.1`, `${FIRST}.Review.1`] },
      { list: "todo", number: 2, frees: [] },
      { list: "todo", number: 3, frees: [] },
      { list: "decide", number: 1, frees: [`${FIRST}.Todo.3`] },
    ]);
  });

  test("is a line no summary alone on its line takes as its body", () => {
    expect(itemsOfText(FREES_REPLY).map((item) => item.line).slice(0, 2)).toEqual([
      "**Paste the release prompt**",
      "**Run the benchmark**",
    ]);
  });

  test("is nothing for a line after a blank line or a separator, which ends the item", () => {
    const text = `👉 **Todo:**${BR}\n1. **Run it**${BR}\n   ${SEP}\n   Frees: ${FIRST}.Todo.2\n2. **Then this**\n\n   Frees: ${FIRST}.Todo.1\n`;
    expect(itemsOfText(text).map((item) => item.frees)).toEqual([[], []]);
  });

  test("is resolved against the items of its turn and earlier ones, by each turn's whole id", () => {
    const next = `👉 **Todo:**${BR}\n1. **Merge the branch**${BR}\n   Frees: ${FIRST.slice(0, 6)}.Todo.3, ${SECOND}.Todo.9, ${THIRD}.Todo.2\n   ${SEP}\n2. **Tag it**\n`;
    const found = allItems([
      turn(FIRST, "go", FREES_REPLY),
      turn(SECOND, "more", next),
      turn(THIRD, "later", next),
    ]);

    expect(found.map((item) => item.frees)).toEqual([
      // Review.1 names no item: the reply printed no Review list.
      [`${FIRST}.Decide.1`],
      [],
      [],
      [`${FIRST}.Todo.3`],
      // Todo.9 is no item, and the third turn is later than the second.
      [`${FIRST}.Todo.3`],
      [],
      [`${FIRST}.Todo.3`, `${THIRD}.Todo.2`],
      [],
    ]);
  });

  test("never names the item itself", () => {
    const text = `👉 **Todo:**${BR}\n1. **Merge the branch**${BR}\n   Frees: ${FIRST}.Todo.1, ${FIRST}.Todo.2\n   ${SEP}\n2. **Tag it**\n`;
    expect(allItems([turn(FIRST, "go", text)]).map((item) => item.frees)).toEqual([
      [`${FIRST}.Todo.2`],
      [],
    ]);
  });

  test("is read past a blank line inside a code block in the item, its fence closed", () => {
    const text = [
      `👉 **Todo:**${BR}`,
      `1. **Paste the release prompt**${BR}`,
      "   ```text",
      "   Tag the release.",
      "",
      "   Then publish it.",
      "   ```",
      `   Frees: ${FIRST}.Todo.2`,
      `   ${SEP}`,
      "2. **Tag it**",
      "",
      `   Frees: ${FIRST}.Todo.1`,
      "",
    ].join("\n");

    expect(itemsOfText(text).map(({ number, line, frees }) => ({ number, line, frees }))).toEqual([
      { number: 1, line: "**Paste the release prompt** ```text", frees: [`${FIRST}.Todo.2`] },
      { number: 2, line: "**Tag it**", frees: [] },
    ]);
  });

  test("is nothing where a code block left open runs to the reply's end", () => {
    const text = `👉 **Todo:**${BR}\n1. **Paste it**${BR}\n   \`\`\`text\n   Frees: ${FIRST}.Todo.2\n\n   two\n`;
    expect(itemsOfText(text).map((item) => item.frees)).toEqual([[]]);
  });

  test("is resolved only against a reassess turn and the turns after it, which replaced every earlier item", () => {
    const first = `👉 **Todo:**${BR}\n1. **Rotate the key**\n2. **Merge the fix**\n`;
    const after = `👉 **Todo:**${BR}\n1. **Deploy the fix**${BR}\n   Frees: ${FIRST}.Todo.2, ${SECOND}.Todo.1\n`;
    const found = allItems([
      turn(FIRST, "go", first),
      turn(SECOND, "reassess", `👉 **Todo:**${BR}\n1. **Merge the fix**\n`),
      turn(THIRD, "and then?", after),
    ]);

    expect(found.map((item) => item.frees)).toEqual([[], [], [], [`${SECOND}.Todo.1`]]);
  });

  test("may name a Decide item a kanban_options call raised", () => {
    const text = `👉 **Todo:**${BR}\n1. **Read the notes**${BR}\n   Frees: ${FIRST}.Decide.4\n`;
    const raised = turnOf(FIRST, "go", {
      replies: [text],
      decide: itemsOf({
        items: [{ turn: FIRST, number: 4, summary: "S", options: [{ letter: "A", name: "a" }] }],
      }),
    });

    expect(allItems([raised]).map((item) => item.frees)).toEqual([[`${FIRST}.Decide.4`]]);
  });
});

/** A numbered item of a reply's own list, or a 📌 bullet, at the turn's place `at`. */
const listed = (
  list: "todo" | "decide",
  at: number,
  number: number | undefined,
  frees: readonly string[] = [],
  isPinned = false,
) => ({ list, at, number, isPinned, line: `**Item ${number ?? "pinned"}**`, frees });

describe("listItemRef", () => {
  const turns = [turnOf(FIRST, "go"), turnOf(SECOND, "more")];

  test("is a numbered item's reference, by its turn's id and its list's header", () => {
    expect(listItemRef(turns, listed("todo", 1, 3))).toBe(`${SECOND}.Todo.3`);
    expect(listItemRef(turns, listed("decide", 0, 1))).toBe(`${FIRST}.Decide.1`);
  });

  test("is none for a 📌 bullet, numbered or not, or an item with no number", () => {
    expect(listItemRef(turns, listed("todo", 1, 3, [], true))).toBeUndefined();
    expect(listItemRef(turns, listed("todo", 1, undefined, [], true))).toBeUndefined();
    expect(listItemRef(turns, listed("todo", 1, undefined))).toBeUndefined();
  });
});

describe("withResolvedFrees", () => {
  const turns = [turnOf(FIRST, "go"), turnOf(SECOND, "more"), turnOf(THIRD, "later")];

  test("resolves each item's references from the reassess turn its span starts at through its own", () => {
    const items = [
      listed("todo", 0, 1),
      listed("todo", 1, 1),
      listed("todo", 2, 1, [`${FIRST}.Todo.1`, `${SECOND}.Todo.1`, `${THIRD}.Todo.1`]),
    ];

    expect(withResolvedFrees(turns, [0, 0, 0], items).map((item) => item.frees)).toEqual([
      [],
      [],
      [`${FIRST}.Todo.1`, `${SECOND}.Todo.1`],
    ]);
    expect(withResolvedFrees(turns, [0, 1, 1], items).map((item) => item.frees)).toEqual([
      [],
      [],
      [`${SECOND}.Todo.1`],
    ]);
  });

  test("knows a Decide item a call raised, and never a 📌 bullet", () => {
    const raised = turnOf(FIRST, "go", {
      decide: itemsOf({
        items: [{ turn: FIRST, number: 2, summary: "S", options: [{ letter: "A", name: "a" }] }],
      }),
    });
    const items = [listed("todo", 0, 4, [], true), listed("todo", 0, 1, [`${FIRST}.Decide.2`, `${FIRST}.Todo.4`])];

    expect(withResolvedFrees([raised], [0], items).map((item) => item.frees)).toEqual([
      [],
      [`${FIRST}.Decide.2`],
    ]);
  });
});

describe("what a Decide item a call raised frees", () => {
  const call = (frees: readonly string[]) =>
    itemsOf({
      items: [{ turn: FIRST, number: 1, summary: "Which cache to keep", options: [{ letter: "A", name: "Keep it" }], frees }],
    });
  const reply = (line: string) =>
    `🧠 **Decide:**${BR}\n▔▔▔▔▔▔▔▔▔▔\n1. **Which cache to keep**${BR}\n   🔘 A. **Keep it**: nothing moves.\n${line}\n👉 **Todo:**${BR}\n1. **Paste it**\n2. **Run it**\n`;
  const freesOf = (text: string, frees: readonly string[]) =>
    decideStates([turnOf(FIRST, "go", { replies: [text], decide: call(frees) })]).map(
      (state) => state.item.frees,
    );

  test("is the reply's `Frees:` line where it names an item, over the call's", () => {
    expect(freesOf(reply(`   Frees: ${FIRST}.Todo.2\n`), [`${FIRST}.Todo.1`])).toEqual([[`${FIRST}.Todo.2`]]);
  });

  test("is the call's where the reply writes no line, or one naming no item", () => {
    expect(freesOf(reply(""), [`${FIRST}.Todo.1`])).toEqual([[`${FIRST}.Todo.1`]]);
    expect(freesOf(reply(`   Frees: ${FIRST}.Todo.9\n`), [`${FIRST}.Todo.1`])).toEqual([[`${FIRST}.Todo.1`]]);
  });

  test("withRepliedFrees matches the reply's item to the call's by turn and number", () => {
    const [item] = call([]);
    const raised = item === undefined ? [] : [{ item, at: 1 }];
    const items = [listed("decide", 1, 1, [`${SECOND}.Todo.1`]), listed("decide", 0, 1, [`${FIRST}.Todo.1`])];

    expect(
      withRepliedFrees([turnOf(FIRST, "go"), turnOf(SECOND, "more")], items, raised).map(
        (entry) => entry.item.frees,
      ),
    ).toEqual([[`${SECOND}.Todo.1`]]);
  });
});

describe("the roll-up keeps what an item frees", () => {
  test("a 📌 bullet that names nothing keeps what its own list's printing freed", () => {
    const first = `👉 **Todo:**${BR}\n▔▔▔▔▔▔▔▔\n1. **Paste the prompt**${BR}\n   Frees: ${FIRST}.Todo.2\n   ${SEP}\n2. **Run it**\n`;
    const pinned = `Later.\n\n📌 **Outstanding from previous turns:**${BR}\n${RULE}\n👉 **Todo:**${BR}\n- **Paste the prompt** 🔖 ${FIRST}₋₁\n- **Run it** 🔖 ${FIRST}₋₁\n`;
    const rolled = rollUp([turn(FIRST, "go", first), turn(SECOND, "more", pinned)], WINDOW);

    expect(rolled.map(({ isPinned, frees }) => ({ isPinned, frees }))).toEqual([
      { isPinned: true, frees: [`${FIRST}.Todo.2`] },
      { isPinned: true, frees: [] },
    ]);
  });
});

describe("an item's summary", () => {
  test("is the bold text without its colon, an older roll-up's tag cut off", () => {
    expect(summaryOf("🔖 c3d4e5f6₋₂: **Another one**: with its text beside it")).toBe("Another one");
  });

  test("without bold text, is the line", () => {
    expect(summaryOf("plain words:")).toBe("plain words");
  });

  test("that is a Markdown link is read whole", () => {
    expect(summaryOf("**[#14 Fix the loader](https://github.com/o/r/pull/14)**: check the cache")).toBe(
      "[#14 Fix the loader](https://github.com/o/r/pull/14)",
    );
  });
});

describe("subjectKey", () => {
  test("a backlog entry is its key", () => {
    expect(subjectKey("Entries 0550 and 0455, dead code")).toBe("entry 0550");
  });

  test("a backlog entry's words are matched ignoring case by ASCII alone, as the long s and the Kelvin sign are no letter of them", () => {
    expect(subjectKey("entrieſ 0550")).toBe("entrie 0550");
    expect(subjectKey("Fix ſentry 0550 now")).toBe("entry 0550");
    expect(subjectKey("Fix Kentry 0550 now")).toBe("entry 0550");
  });

  test("a backlog entry's number is 3 or 4 digits", () => {
    expect(subjectKey("Fix entry 055 now")).toBe("entry 055");
    expect(subjectKey("Fix entry 1234 now")).toBe("entry 1234");
    expect(subjectKey("Fix entry 12 now")).toBe("fix entry 12");
    expect(subjectKey("Fix entry 12345 now")).toBe("fix entry 12345");
  });

  test("a backlog entry is whole words: no letter or digit runs on either side", () => {
    expect(subjectKey("Fix sentry 0550 now")).toBe("fix sentry 0550");
    expect(subjectKey("Fix entry 0550a now")).toBe("fix entry 0550a");
    expect(subjectKey("Fix entries 05501 now")).toBe("fix entries 05501");
  });

  test("a backlog entry's word and number are parted by any run of white space", () => {
    expect(subjectKey("Fix entry\t0550 now")).toBe("entry 0550");
    expect(subjectKey("Fix entry\n0550 now")).toBe("entry 0550");
    expect(subjectKey("Fix entry   0550 now")).toBe("entry 0550");
    expect(subjectKey("Fix entry0550 now")).toBe("fix entry0550 now");
  });

  test("a backlog entry wins over a branch-shaped code span, wherever each stands", () => {
    expect(subjectKey("Merge `atomic-reload` for entry 0550")).toBe("entry 0550");
    expect(subjectKey("Entry 0550: merge `atomic-reload`")).toBe("entry 0550");
  });

  test("else a branch-shaped code span", () => {
    expect(subjectKey("Merge `README.md` and `atomic-reload` today")).toBe("branch atomic-reload");
  });

  test("leaves out every article and preposition, each as written here", () => {
    const stopWords = "a an and at by for from in is its of on the to with".split(" ");

    expect(stopWords.map((word) => subjectKey(`Ship ${word} release ${word} users`))).toEqual(
      stopWords.map(() => "ship release users"),
    );
    expect(subjectKey("Ship into release as users")).toBe("ship into release");
  });

  test("a branch name may hold every lowercase letter and digit", () => {
    expect(subjectKey("Merge `abcdefghijklm-nopqrstuvwxyz-0123456789`")).toBe(
      "branch abcdefghijklm-nopqrstuvwxyz-0123456789",
    );
  });

  test("else the first three words that are not articles or prepositions", () => {
    expect(subjectKey("Ship the release to users tonight?")).toBe("ship release users");
    expect(subjectKey("Ship the release to users")).toBe(subjectKey("Ship release, users first"));
  });

  test("else the summary's letters and digits", () => {
    expect(subjectKey("ça é")).toBe("çaé");
  });
});

const pending = (summary: string, body: string) =>
  `🚧 **Pending:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **${summary}** ${body}\n`;

describe("countLine", () => {
  const rolled = (third: string): readonly Turn[] =>
    numbered([
      turn("", "go", pending("Rework the loader", "It reads twice.")),
      turn(
        "",
        "more",
        `${pending("Rework the loader", "It reads twice.")}\n👉 **Todo:**  \n1. **Paste the prompt** now.\n`,
      ),
      turn(
        "",
        "more",
        `${pending("Rework the loader", third)}\n📌 **Outstanding from previous turns:**  \n${RULE}\n👉 **Todo:**  \n- **Paste the prompt** 🔖 b2c3d4e5₋₁\n`,
      ),
    ]);

  test("is one line in the skill's order, each item once however often restated", () => {
    expect(countLine(rolled("It reads twice."), WINDOW)).toBe("📌 Outstanding: 🚧 1 · 👉 1");
  });

  test("starts at the latest recheck turn", () => {
    expect(
      countLine(
        numbered([
          turn("", "go", pending("Dropped by the recheck", "x")),
          turn("", "recheck", pending("Rework the loader", "y")),
          turn("", "go on", pending("Another job", "z")),
        ]),
        WINDOW,
      ),
    ).toBe("📌 Outstanding: 🚧 2");
  });

  test("reads only the last turns the window holds, and every turn for a window of 0 or less", () => {
    const rows = numbered([
      turn("", "go", pending("Rework the loader", "x")),
      turn("", "more", pending("Another job", "y")),
    ]);
    expect(countLine(rows, 1)).toBe("📌 Outstanding: 🚧 1");
    expect(countLine(rows, 0)).toBe("📌 Outstanding: 🚧 2");
    expect(countLine(rows, -1)).toBe("📌 Outstanding: 🚧 2");
  });

  test("counts Waiting items under the hourglass, an older reply's thinking face too", () => {
    for (const glyph of ["⏳", "🤔"]) {
      const waiting = `${glyph} **Waiting:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **The test run** in the background.\n`;
      expect(countLine(numbered([turn("", "go", waiting), turn("", "more", "Prose.")]), WINDOW)).toBe(
        "📌 Outstanding: ⏳ 1",
      );
    }
  });

  test("counts Authorizations between Waiting and Review", () => {
    const text =
      "⏳ **Waiting:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **The test run**\n\n" +
      "🔑 **Authorizations:**  \n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n" +
      "1. **1Password prompt for the merge token**  \n" +
      "   - #12 Fix the loader\n" +
      "   - #13 Bump the lock\n" +
      `   ${SEP}\n\n` +
      "🔍 **Review:**  \n▔▔▔▔▔▔▔▔▔▔\n1. **#14 The README**\n";
    expect(countLine(numbered([turn("", "go", text), turn("", "more", "Prose.")]), WINDOW)).toBe(
      "📌 Outstanding: ⏳ 1 · 🔑 1 · 🔍 1",
    );
  });

  test("two grants of one kind, led by what they unblock, stay two items", () => {
    const grant = (summary: string) =>
      `🔑 **Authorizations:**  \n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n1. **${summary}**\n`;
    expect(
      countLine(
        numbered([
          turn("", "go", grant("The `v2.4.0` tag's SSH signature")),
          turn("", "more", grant("The `v2.5.0` tag's SSH signature")),
          turn("", "more", "Prose."),
        ]),
        WINDOW,
      ),
    ).toBe("📌 Outstanding: 🔑 2");
  });

  test("nothing open is no line", () => {
    expect(countLine(numbered([turn("", "go", "Prose only.")]), WINDOW)).toBe("");
  });

  test("windowStart is the window's first turn, never before the latest reassess", () => {
    const found = numbered(["a", "reassess", "b", "c"].map((text) => turn("", text)));
    expect(windowStart(found, 2)).toBe(2);
    expect(windowStart(found, 4)).toBe(1);
    expect(windowStart(found, 10)).toBe(1);
    expect(windowStart(found, 0)).toBe(1);
  });
});

/** The lines of the items left open in the roll-up over the last WINDOW turns. */
const openLines = (found: readonly Turn[], merged: ReadonlySet<string> = new Set()) =>
  unsettled(found, rollUp(found, WINDOW), merged)
    .map((item) => item.line)
    .join("\n");

/** The count line over the last WINDOW turns. */
const counted = (found: readonly Turn[], merged: ReadonlySet<string> = new Set()) =>
  countLine(found, WINDOW, merged);

const REVIEW_REPLY =
  "🔍 **Review:**  \n▔▔▔▔▔▔▔▔▔▔\n" +
  "1. **🔗 [#21 Close the pane](https://github.com/nhooey/kanban/pull/21)**\n" +
  "2. **nhooey/kanban#22 Bump the lock**, on top of nhooey/kanban#21\n" +
  "3. **#23 The README**\n";

const waiting = (summary: string) =>
  `⏳ **Waiting:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **${summary}**\n`;

describe("a settled Review item", () => {
  const reviewed = () => [turn(FIRST, "go", REVIEW_REPLY), turn(SECOND, "more", "Prose.")];

  test("the pull requests an item names", () => {
    expect(pullRequestsOf(REVIEW_REPLY)).toEqual(["nhooey/kanban#21", "nhooey/kanban#22"]);
  });

  test("a merged pull request settles its Review item", () => {
    const out = openLines(reviewed(), new Set(["nhooey/kanban#21"]));
    expect(out).not.toContain("Close the pane");
    // #22 names #21 too, but #22 itself is open; #23 names no repository, so nothing settles it
    expect(out).toContain("nhooey/kanban#22 Bump the lock");
    expect(out).toContain("#23 The README");
  });

  test("an item settles once every pull request it names has merged", () => {
    expect(counted(reviewed(), new Set(["nhooey/kanban#21", "nhooey/kanban#22"]))).toBe("📌 Outstanding: 🔍 1");
  });

  test("no merged pull request keeps every item", () => {
    expect(counted(reviewed())).toBe("📌 Outstanding: 🔍 3");
  });

  test("the GraphQL response names the merged ones", () => {
    const ordered = ["nhooey/kanban#21", "nhooey/kanban#22", "nhooey/kanban#24"];
    const response = JSON.stringify({
      data: {
        pr0: { pullRequest: { state: "MERGED" } },
        pr1: { pullRequest: { state: "OPEN" } },
        pr2: null,
      },
    });
    expect([...mergedOfResponse(ordered, response)]).toEqual(["nhooey/kanban#21"]);
    for (const broken of ["", "not json", "[]", '{"data": null}']) {
      expect([...mergedOfResponse(ordered, broken)]).toEqual([]);
    }
  });

  test("the merges are known only where the response's data answers for every pull request asked", () => {
    const ordered = ["nhooey/kanban#21", "nhooey/kanban#22"];
    const answered = {
      pr0: { pullRequest: { state: "MERGED" } },
      pr1: { pullRequest: { state: "OPEN" } },
    };
    expect(isMergeKnown(ordered, JSON.stringify({ data: answered }))).toBe(true);
    expect(isMergeKnown(ordered, JSON.stringify({ data: { pr0: answered.pr0, pr1: null } }))).toBe(false);
    expect(
      isMergeKnown(ordered, JSON.stringify({ errors: [{ message: "Bad credentials" }] })),
    ).toBe(false);
    for (const broken of ["", "not json", "[]", '{"data": null}']) {
      expect(isMergeKnown(ordered, broken)).toBe(false);
    }
    expect(isMergeKnown([], "")).toBe(true);
  });

  test("GitHub is asked about the Review items' pull requests, in one gh call", () => {
    const refs = pullRequestsToAsk(reviewed(), WINDOW);
    expect(refs).toEqual(["nhooey/kanban#21", "nhooey/kanban#22"]);
    const { ordered, argv } = mergedQuery(refs);
    expect(ordered).toEqual(refs);
    expect(argv.slice(0, 4)).toEqual(["gh", "api", "graphql", "-f"]);
    expect(argv[4]).toContain('pr0: repository(owner: "nhooey", name: "kanban") { pullRequest(number: 21)');
    expect(argv[4]).toContain("pr1: repository(owner: \"nhooey\", name: \"kanban\") { pullRequest(number: 22) { state } }");
    expect(argv.slice(5)).toEqual(["--hostname", "github.com"]);
  });

  test("a pull request already known merged is not asked about again", () => {
    expect(pullRequestsToAsk(reviewed(), WINDOW, new Set(["nhooey/kanban#21"]))).toEqual([
      "nhooey/kanban#22",
    ]);
  });

  test("a bare `#N` is never asked about", () => {
    expect(pullRequestsToAsk([turn(FIRST, "go", "🔍 **Review:**  \n1. **#23 The README**\n")], WINDOW)).toEqual([]);
  });
});

describe("a settled Decide item", () => {
  test("numbered answers on one line", () => {
    for (const line of ["1. A / 3. Y", "1. A; 3. Y", "1. A, 3. Y", "1.A/3.Y"]) {
      expect(answersOfLine(line)).toEqual([
        { turn: "", number: 1, letters: ["A"], note: "" },
        { turn: "", number: 3, letters: ["Y"], note: "" },
      ]);
    }
    expect(answersOfLine("2. A, C")).toEqual([{ turn: "", number: 2, letters: ["A", "C"], note: "" }]);
    expect(answersOfLine("1. A / 3. Y?")).toEqual([]);
  });

  test("an answered Decide item leaves the roll-up", () => {
    for (const answer of ["9efb08a1.Decide.1.A", "Decide.1: B", "1. A", "1. A / 3. Y"]) {
      const out = openLines([turn(FIRST, "go", DECIDE_REPLY), turn(SECOND, answer, "Prose.")]);
      expect(out).not.toContain("Which cache to keep");
      expect(out).toContain("Backlog cleanups to start");
    }
  });

  test("answers to items 1 and 3 leave item 2", () => {
    // the 📌 roll-up's "An older decision" was never answered
    expect(counted([turn(FIRST, "go", DECIDE_REPLY), turn(SECOND, "1. A / 3. Y", "Prose.")])).toBe(
      "📌 Outstanding: 🧠 2",
    );
  });

  test("an answer holding a question leaves its item open", () => {
    expect(
      openLines([turn(FIRST, "go", DECIDE_REPLY), turn(SECOND, "1. B? how would B work", "Prose.")]),
    ).toContain("Which cache to keep");
  });

  test("a roll-up restating an answered item does not reopen it", () => {
    const rollUpReply = `Prose.\n\n📌 **Outstanding from previous turns:**  \n${RULE}\n🧠 **Decide:**  \n- **Which cache to keep for the loader** 🔖 9efb08a1₋₁\n`;
    expect(
      openLines([turn(FIRST, "go", DECIDE_REPLY), turn(SECOND, "Decide.1: A", rollUpReply)]),
    ).not.toContain("Which cache to keep");
  });

  test("an answered item seen only in roll-ups, after its own line left the window, stays settled", () => {
    const decision = `🧠 **Decide:**  \n▔▔▔▔▔▔▔▔▔▔\n1. **Which cache to keep for the loader**  \n   🔘 A. **Disk**: x.\n   🔘 B. **Memory**: y.\n`;
    const rollUpReply = `Prose.\n\n📌 **Outstanding from previous turns:**  \n${RULE}\n🧠 **Decide:**  \n- **Which cache to keep for the loader** 🔖 9efb08a1₋₁\n`;
    const session = (answer: string) => [
      turn(FIRST, "go", decision),
      turn(SECOND, answer, rollUpReply),
      ...Array.from({ length: WINDOW }, (_, n) => turn(`aaaa${String(n).padStart(4, "0")}`, "more", rollUpReply)),
    ];
    expect(windowStart(session("1. A"), WINDOW)).toBeGreaterThan(1);
    expect(counted(session("more"))).toBe("📌 Outstanding: 🧠 1");
    expect(counted(session("1. A"))).toBe("");
  });

  test("answeredSubjects names the answered items' subjects", () => {
    expect([...answeredSubjects([turn(FIRST, "go", DECIDE_REPLY), turn(SECOND, "1. A / 3. B")])]).toEqual([
      subjectKey(SUMMARIES[0] ?? ""),
      subjectKey(SUMMARIES[2] ?? ""),
    ]);
  });

  test("an item answered in a report, another session's message or a notification stays open", () => {
    for (const text of [
      '<agent-message from="a48bb9142825233bb">\n1. A\n</agent-message>',
      "Another Claude session sent a message:\n1. A",
      "<task-notification>\n<summary>\n1. A\n</summary>\n</task-notification>",
    ]) {
      expect(
        openLines([turn(FIRST, "go", DECIDE_REPLY), report(SECOND, text, ["a48bb9142825233bb"], "Prose.")]),
      ).toContain("Which cache to keep");
    }
  });
});

describe("a settled Waiting item", () => {
  test("a report sent while a turn ran settles its item", () => {
    for (const owner of ["peer", "notification"] as const) {
      expect(
        counted([
          turn(FIRST, "go", waiting("Watcher (`b8a83gfv0`)")),
          turnOf(SECOND, "more", { replies: ["Prose."], messages: [said("Done.", owner, ["b8a83gfv0"])] }),
        ]),
      ).toBe("");
    }
  });

  test("the user's own text is no report, though it names the item", () => {
    for (const turns of [
      [turnOf(SECOND, "done", { reportNames: ["b8a83gfv0"], replies: ["Prose."] })],
      [turnOf(SECOND, "more", { replies: ["Prose."], messages: [said("done", "user", ["b8a83gfv0"])] })],
    ]) {
      expect(counted([turn(FIRST, "go", waiting("Watcher (`b8a83gfv0`)")), ...turns])).toBe(
        "📌 Outstanding: ⏳ 1",
      );
    }
  });

  test("a draft the pane's Submit sent is no report, though it names the item; another plugin's prompt is", () => {
    const after = (owner: Owner) =>
      counted([
        turn(FIRST, "go", waiting("Watcher (`b8a83gfv0`)")),
        turnOf(SECOND, "done", { owner, reportNames: ["b8a83gfv0"], replies: ["Prose."] }),
      ]);
    expect(after("this-plugin")).toBe("📌 Outstanding: ⏳ 1");
    expect(after("other-plugin")).toBe("");
  });

  test("a report going by the task's name settles its item", () => {
    expect(
      counted([
        turn(FIRST, "go", `${waiting("Watcher on #143 (`b8a83gfv0`)")}\n${pending("Rework the loader", "x")}`),
        report(SECOND, "The watcher completed.", ["b8a83gfv0", "watch"], "Prose."),
      ]),
    ).toBe("📌 Outstanding: 🚧 1");
  });

  test("a report holding the item's branch settles it", () => {
    expect(
      openLines([
        turn(FIRST, "go", waiting("The implementer, on branch `outstanding-settled-items`")),
        report(SECOND, "Pushed branch outstanding-settled-items at 1234abc.", ["a48bb9142825233bb"], "Prose."),
      ]),
    ).toBe("");
  });

  test("a report going by the session the item names settles it", () => {
    expect(
      openLines([
        turn(FIRST, "go", waiting("github-config: the two fixes")),
        report(SECOND, "Done.", ["github-config"], "Prose."),
      ]),
    ).toBe("");
  });

  test("a report naming something else settles nothing", () => {
    expect(
      counted([
        turn(FIRST, "go", waiting("github-config: the two fixes")),
        report(SECOND, "FYI.", ["MyNixOS"], "Prose."),
      ]),
    ).toBe("📌 Outstanding: ⏳ 1");
  });

  test("a message that is no report settles nothing, though it names the item", () => {
    expect(
      counted([
        turn(FIRST, "go", waiting("Watcher (`b8a83gfv0`)")),
        report(SECOND, "b8a83gfv0 is still running", undefined, "Prose."),
      ]),
    ).toBe("📌 Outstanding: ⏳ 1");
  });

  test("an item its own list restates after the report stays open", () => {
    expect(
      counted([
        turn(FIRST, "go", waiting("Watcher (`b8a83gfv0`)")),
        report(SECOND, "done", ["b8a83gfv0"], `${waiting("Watcher (`b8a83gfv0`)")}   Re-armed.\n`),
        turn(THIRD, "more", "Prose."),
      ]),
    ).toBe("📌 Outstanding: ⏳ 1");
  });

  test("a roll-up restating it after the report does not reopen it", () => {
    const rollUpReply =
      `Prose.\n\n📌 **Outstanding from previous turns:**  \n${RULE}\n⏳ **Waiting:**  \n` +
      "- **Watcher (`b8a83gfv0`)** 🔖 9efb08a1₋₂\n";
    expect(
      openLines([
        turn(FIRST, "go", waiting("Watcher (`b8a83gfv0`)")),
        report(SECOND, "gone", ["b8a83gfv0"], "Prose."),
        turn(THIRD, "more", rollUpReply),
        turn(FOURTH, "more"),
      ]),
    ).toBe("");
  });
});

describe("the lists nothing but a reassess settles", () => {
  test("Pending, Authorizations and Todo items stay open whatever the user names", () => {
    const text =
      `${pending("Rework the loader", "x")}\n` +
      "🔑 **Authorizations:**  \n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n1. **The `v2.4.0` tag's SSH signature**\n\n" +
      "👉 **Todo:**  \n▔▔▔▔▔▔▔▔\n1. **Paste the prompt**\n";
    expect(
      counted([
        turn(FIRST, "go", text),
        turn(SECOND, "Pending.1 done\nAuthorizations.1 done\nTodo.1 done\n1. A", "Prose."),
      ]),
    ).toBe("📌 Outstanding: 🚧 1 · 🔑 1 · 👉 1");
  });
});

/** An item of `list` on `line`, printed by its own list in the turn at `at`. */
const listItem = (list: ListKey, line: string, at = 0): ListItem => ({
  list,
  at,
  number: 1,
  isPinned: false,
  line,
  frees: [],
});

/** The key an item's last printing goes by in `lastOwn`: its list and its subject. */
const ownKey = (item: ListItem): string => `${item.list}\t${subjectKey(summaryOf(item.line))}`;

/** What settles nothing: no merges, answers, reports or printings. */
const NOTHING: Settling = {
  merged: new Set(),
  decided: new Set(),
  worded: new Set(),
  reports: [],
  lastOwn: new Map(),
};

describe("the settlers, by the way a list is settled", () => {
  test("each list that rolls up is settled the way its settled-by names", () => {
    expect(
      Object.fromEntries(
        LIST_KEYS.map((key) => [
          key,
          Object.entries(SETTLERS).find(
            ([, settler]) => settler === settlerOf({ list: key }),
          )?.[0],
        ]),
      ),
    ).toEqual({
      pending: "none",
      waiting: "report",
      authorizations: "none",
      review: "merged-pull-request",
      todo: "settling-word",
      decide: "answer",
    });
  });

  test("cover every way the spec's schema allows, and nothing else", () => {
    const schema = parseYaml(
      readFileSync(new URL("../../../spec/kanban.schema.yaml", import.meta.url), "utf8"),
    );
    const ways = ["value", "definitions", "list", "properties", "settled-by", "enum"].reduce(
      field,
      schema as unknown,
    );
    expect(Object.keys(SETTLERS).toSorted()).toEqual(
      (Array.isArray(ways) ? ways : []).toSorted(),
    );
  });

  test("merged-pull-request settles an item once every pull request it names with its repository merged", () => {
    const { settles, pullRequests } = SETTLERS["merged-pull-request"];
    const both = listItem("review", "**example/kanban#22 Bump** on example/other#7");
    const merged = (refs: readonly string[]) => ({ ...NOTHING, merged: new Set(refs) });
    expect(settles(both, merged(["example/kanban#22", "example/other#7"]))).toBe(true);
    expect(settles(both, merged(["example/kanban#22"]))).toBe(false);
    expect(settles(listItem("review", "**#23 The README**"), merged(["example/kanban#23"]))).toBe(false);
    expect(pullRequests(both)).toEqual(["example/kanban#22", "example/other#7"]);
  });

  test("answer settles an item whose subject the user answered", () => {
    const { settles, pullRequests } = SETTLERS.answer;
    const item = listItem("decide", "**Which cache to keep for the loader**");
    expect(settles(item, { ...NOTHING, decided: new Set([subjectKey(summaryOf(item.line))]) })).toBe(true);
    expect(settles(item, NOTHING)).toBe(false);
    expect(pullRequests(listItem("decide", "**example/kanban#22 Bump**"))).toEqual([]);
  });

  test("settling-word settles an item whose subject's latest printing a settling word settled", () => {
    const { settles, pullRequests } = SETTLERS["settling-word"];
    const item = listItem("todo", "**Rotate the deploy token**");
    expect(settles(item, { ...NOTHING, worded: new Set([subjectKey(summaryOf(item.line))]) })).toBe(true);
    expect(settles(item, NOTHING)).toBe(false);
    expect(pullRequests(listItem("todo", "**example/kanban#22 Bump**"))).toEqual([]);
  });

  test("report settles an item a report names after the last turn its own list printed it in", () => {
    const { settles, pullRequests } = SETTLERS.report;
    const item = listItem("waiting", "**Watcher (`b8a83gfv0`)**", 1);
    const reported = (n: number) => ({
      ...NOTHING,
      reports: [{ n, names: ["b8a83gfv0"], report: "Done." }],
      lastOwn: new Map([[ownKey(item), 1]]),
    });
    expect(settles(item, reported(2))).toBe(true);
    expect(settles(item, reported(1))).toBe(false);
    expect(settles(item, NOTHING)).toBe(false);
    expect(pullRequests(listItem("waiting", "**example/kanban#22 Bump**"))).toEqual([]);
  });

  test("none settles nothing and asks about no pull request", () => {
    const { settles, pullRequests } = SETTLERS.none;
    const item = listItem("todo", "**example/kanban#22 Bump**");
    expect(settles(item, { ...NOTHING, merged: new Set(["example/kanban#22"]) })).toBe(false);
    expect(pullRequests(item)).toEqual([]);
  });

  test("settlingOf reads the merges, the answered subjects, the reports others sent and each item's last printing since reassess", () => {
    const found = [
      turn(FIRST, "go", waiting("Watcher (`b8a83gfv0`)"), DECIDE_REPLY),
      turnOf(SECOND, "1. A", {
        replies: [waiting("Watcher (`b8a83gfv0`)")],
        messages: [said("Done.", "notification", ["b8a83gfv0"]), said("Mine.", "user", ["x"])],
      }),
      report(THIRD, "Pushed.", ["a48bb"]),
    ];
    const settling = settlingOf(found, new Set(["example/kanban#22"]));
    expect(settling.merged).toEqual(new Set(["example/kanban#22"]));
    expect(settling.decided).toEqual(answeredSubjects(found));
    expect(settling.decided.size).toBeGreaterThan(0);
    expect(settling.reports).toEqual([
      { n: 1, names: ["b8a83gfv0"], report: "Done." },
      { n: 2, names: ["a48bb"], report: "Pushed." },
    ]);
    expect(settling.lastOwn.get(ownKey(listItem("waiting", "**Watcher (`b8a83gfv0`)**")))).toBe(1);
  });
});

describe("openOf", () => {
  test("gives the open Decide items and the count line, nothing wrong", () => {
    const open = openOf([decided(FIRST)], WINDOW);
    expect(open.items.map((item) => item.ref)).toEqual([
      "9efb08a1.Decide.1",
      "9efb08a1.Decide.2",
      "9efb08a1.Decide.3",
    ]);
    expect(open.counts).toBe("📌 Outstanding: 🧠 4");
  });

  test("the count line leaves out the Review items whose pull requests merged", () => {
    const found = [turn(FIRST, "go", REVIEW_REPLY)];
    expect(openOf(found, WINDOW, new Set(["nhooey/kanban#21"])).counts).toBe("📌 Outstanding: 🔍 2");
  });

  test("its items and settlements are the open and settled ones of one reading", () => {
    const found = [decided(FIRST), turn(SECOND, "1. A")];
    const open = openOf(found, WINDOW);
    expect(open.items).toEqual(openDecideItems(found));
    expect(open.settlements).toEqual(settlementsOf(found));
  });

  test("reads each turn's replies at most twice: once for every item, once for the Decide items its lists print", () => {
    const reads = FACTS_TURNS.map(() => 0);
    const watched = FACTS_TURNS.map(
      (found, at) =>
        new Proxy(found, {
          get: (target, field, receiver) => {
            reads[at] = (reads[at] ?? 0) + (field === "replies" ? 1 : 0);

            return Reflect.get(target, field, receiver);
          },
        }),
    );
    openOf(watched, WINDOW, new Set(["example/kanban#22"]));
    expect(reads.every((count) => count >= 1 && count <= 2)).toBe(true);
  });

  test("reads each turn's fields once per reading that needs them, over random turns: its prompt at most four times, its replies, Decide items and messages at most twice", () => {
    fc.assert(
      fc.property(readTurnsArb, fc.constantFrom(0, 1, 3, 20), (turns, window) => {
        expect(overRead(turns, window)).toEqual([]);
      }),
      { seed: 0x6f70656e, numRuns: 400 },
    );
  });

  test("the random turns raise Decide items, free items, open turns a peer or a task sent, and reassess", () => {
    const drawn = fc.sample(readTurnsArb, { seed: 0x6f70656e, numRuns: 400 }).flat();

    expect(drawn.some((one) => one.decide.length > 0)).toBe(true);
    expect(drawn.some((one) => one.replies.some((reply) => reply.includes("Frees:")))).toBe(true);
    expect(drawn.some((one) => (one.decide[0]?.frees ?? []).length > 0)).toBe(true);
    expect(new Set(drawn.map((one) => one.prompt.owner))).toEqual(new Set(READ_OWNERS));
    expect(drawn.some((one) => one.prompt.text === "reassess")).toBe(true);
  });
});

/** The most reads of each field of one turn `openOf` may make, one per reading that needs it. */
const MOST_READS = { prompt: 4, replies: 2, decide: 2, messages: 2 } as const;
type ReadField = keyof typeof MOST_READS;
const READ_FIELDS = Object.keys(MOST_READS) as readonly ReadField[];

/** The fields of `turns` that `openOf` read more often than MOST_READS allows, as `[turn's place, field, reads]`. */
const overRead = (turns: readonly Turn[], window: number): readonly (readonly [number, string, number])[] => {
  const read = mock.fn((_at: number, _field: string) => undefined);
  const watched = turns.map(
    (found, at) =>
      new Proxy(found, {
        get: (target, field, receiver) => {
          read(at, String(field));

          return Reflect.get(target, field, receiver);
        },
      }),
  );
  openOf(watched, window, new Set(["example/kanban#22"]));
  const calls = read.mock.calls.map((call) => call.arguments);

  return turns.flatMap((_, at) =>
    READ_FIELDS.flatMap((field) => {
      const count = calls.filter(([place, name]) => place === at && name === field).length;

      return count > MOST_READS[field] ? [[at, field, count] as const] : [];
    }),
  );
};

const READ_REFS = [
  "00000000.Todo.1",
  "00000000.Pending.1",
  "00000001.Decide.1",
  "00000002.Pending.1",
  "00000003.Todo.1",
  "00000005.Decide.2",
] as const;

const READ_REPLIES = [
  "Prose.\n\n🧠 **Decide:**\n▔▔▔▔▔▔▔▔▔▔\n1. **Which cache to keep for the loader**\n   🔘 A. **Disk**: x.\n   🔘 B. **Memory**: y.\n   Frees: 00000000.Todo.1, 00000002.Pending.1\n   ⠀\n2. **Ship the release tonight?**\n   🔘 A. **Ship it**: out.\n   🔘 B. **Hold it**: waits.\n",
  "Prose only.",
  "🚧 **Pending:**  \n1. **Rework the loader** It reads twice.\n   Frees: 00000000.Todo.1, 00000001.Decide.1\n",
  "👉 **Todo:**  \n1. **Paste the prompt**\n   Frees: 00000000.Pending.1\n",
  "⏳ **Waiting:**  \n1. **Watcher (`b8a83gfv0`)**\n2. **The implementer, on branch `outstanding-settled-items`**\n",
  "🔍 **Review:**  \n1. **🔗 [#21 Close](https://github.com/example/kanban/pull/21)**\n   ⠀\n2. **example/kanban#22 Bump**  \n   It sits on example/other#7.\n   Frees: 00000003.Todo.1\n",
  `Prose.\n\n📌 **Outstanding from previous turns:**  \n${"━".repeat(35)}\n🧠 **Decide:**  \n- **Which cache to keep for the loader** 🔖 00000001₋₁\n🚧 **Pending:**  \n- **Rework the loader** 🔖 00000002₋₁\n⏳ **Waiting:**  \n- **Watcher (\`b8a83gfv0\`)** 🔖 00000001₋₂\n`,
] as const;

const READ_PROMPTS = ["go", "1. A", "2. B", "Decide.1: B", "00000001.Decide.1.A", "1. B? how would B work", "reassess", "Todo.1: done"] as const;

const READ_OWNERS: readonly Owner[] = ["user", "this-plugin", "peer", "notification"];

const readMessageArb = fc
  .constantFrom<readonly [string, Owner, readonly string[] | undefined]>(
    ["2. B", "user", undefined],
    ["1. A", "peer", undefined],
    ["Task done.", "notification", ["b8a83gfv0"]],
    ["Pushed branch outstanding-settled-items.", "peer", ["a48bb"]],
  )
  .map(([text, owner, names]) => said(text, owner, names));

/** Random turns that answer, reassess, free items, raise Decide items by a call and settle by merges and reports, each turn's id its place. */
const readTurnsArb: fc.Arbitrary<readonly Turn[]> = fc
  .array(
    fc.record({
      prompt: fc.constantFrom(...READ_PROMPTS),
      owner: fc.constantFrom(...READ_OWNERS),
      replies: fc.array(fc.constantFrom(...READ_REPLIES), { maxLength: 3 }),
      raised: fc.integer({ min: 0, max: 2 }),
      frees: fc.subarray([...READ_REFS], { maxLength: 2 }),
      messages: fc.array(readMessageArb, { maxLength: 2 }),
    }),
    { minLength: 1, maxLength: 9 },
  )
  .map((drawn) =>
    drawn.map(({ prompt, owner, replies, raised, frees, messages }, at) => {
      const id = String(at).padStart(8, "0");

      return turnOf(id, prompt, {
        owner,
        reportNames: owner === "user" ? undefined : ["b8a83gfv0"],
        replies,
        decide: itemsOf({
          items: ["Which cache to keep for the loader", "Ship the release tonight?"].slice(0, raised).map((summary, n) => ({
            turn: id,
            number: n + 1,
            summary,
            kind: "radio",
            options: [
              { letter: "A", name: "First" },
              { letter: "B", name: "Second" },
            ],
            frees,
          })),
        }),
        messages,
      });
    }),
  );

/** Turns that reassess, answer and report, each printing Decide and Waiting items. */
const FACTS_TURNS: readonly Turn[] = [
  turn(FIRST, "go", waiting("Watcher (`b8a83gfv0`)"), DECIDE_REPLY),
  turnOf(SECOND, "reassess", {
    replies: [DECIDE_REPLY, waiting("Watcher (`b8a83gfv0`)")],
    messages: [said("Done.", "notification", ["b8a83gfv0"])],
  }),
  turn(THIRD, "1. A", DECIDE_REPLY.replace("**Ship", "**Hold")),
];

/** An item as a line: its list, its turn's place, its number or `-`, a pin where a roll-up held it, and its summary. */
const itemLine = (item: ListItem): string =>
  [item.list, item.at, item.number ?? "-", item.isPinned ? "📌" : "", summaryOf(item.line)].join(" ");

describe("factsOf", () => {
  test("holds the turns, the latest reassess, the answers and every item", () => {
    const facts = factsOf(FACTS_TURNS);
    expect(facts.turns).toBe(FACTS_TURNS);
    expect(facts.start).toBe(1);
    expect(facts.answers).toEqual([
      { turn: "", number: 1, letters: ["A"], note: "", at: 1, sent: THIRD },
    ]);
    expect(facts.items.map(itemLine)).toEqual([
      "waiting 0 1  Watcher (`b8a83gfv0`)",
      "decide 0 1  Which cache to keep for the loader",
      "decide 0 2  Backlog cleanups to start",
      "decide 0 3  Ship the release tonight?",
      "decide 0 - 📌 An older decision",
      "decide 1 1  Which cache to keep for the loader",
      "decide 1 2  Backlog cleanups to start",
      "decide 1 3  Ship the release tonight?",
      "decide 1 - 📌 An older decision",
      "waiting 1 1  Watcher (`b8a83gfv0`)",
      "decide 2 1  Which cache to keep for the loader",
      "decide 2 2  Backlog cleanups to start",
      "decide 2 3  Hold the release tonight?",
      "decide 2 - 📌 An older decision",
    ]);
  });

  test("holds each item's latest printing in its own list since the latest reassess, by its key", () => {
    expect(
      [...factsOf(FACTS_TURNS).latestOwn].map(([key, item]) => [key, itemLine(item)]),
    ).toEqual([
      ["decide\twhich cache keep", "decide 2 1  Which cache to keep for the loader"],
      ["decide\tbacklog cleanups start", "decide 2 2  Backlog cleanups to start"],
      ["decide\tship release tonight", "decide 1 3  Ship the release tonight?"],
      ["waiting\twatcher b8a83gfv0", "waiting 1 1  Watcher (`b8a83gfv0`)"],
      ["decide\thold release tonight", "decide 2 3  Hold the release tonight?"],
    ]);
  });

  test("of no turns, holds nothing and starts at the first turn", () => {
    expect(factsOf([])).toEqual({
      turns: [],
      start: 0,
      answers: [],
      words: [],
      items: [],
      latestOwn: new Map(),
    });
  });
});

describe("openItemsIn and settlementsIn", () => {
  test("split the items' states into the open items and how the others settled, in order", () => {
    const states = decideStates([decided(FIRST), turn(SECOND, "1. A")]);
    expect(openItemsIn(states).map((item) => item.ref)).toEqual(["9efb08a1.Decide.2", "9efb08a1.Decide.3"]);
    expect(settlementsIn(states)).toEqual([
      { ref: "9efb08a1.Decide.1", how: "answered", turn: SECOND, letters: ["A"], note: "" },
    ]);
  });

  test("are empty for no states", () => {
    expect(openItemsIn([])).toEqual([]);
    expect(settlementsIn([])).toEqual([]);
  });
});

describe("itemsOfText, as parseReply reads a reply", () => {
  test("an older roll-up header bare pins nothing: only the 📌 glyph and bold do", () => {
    for (const older of ["Still open from earlier", "Still open from earlier:", "Still open from earlier, the README."]) {
      const text = `👉 **Todo:**${BR}\n1. **Run it**\n\n${older}\n📋 **To review:**${BR}\n- **The README** 🔖 b2c3d4e5₋₁\n`;

      expect(itemsOfText(text).map((item) => item.isPinned)).toEqual([false, false]);
    }
  });

  test("a fence less indented than an item's text ends the item, and is no line beneath its summary", () => {
    const text = `👉 **Todo:**${BR}\n 2) **Run it**${BR}\n   \`\`\`text\n   \`\`\`\n`;

    expect(itemsOfText(text).map((item) => item.line)).toEqual(["**Run it**"]);
  });

  test("a code block holds code wherever it is: outside a list, or under an item of a list that doesn't roll up", () => {
    const outside = `Some work.\n\n\`\`\`text\n👉 **Todo:**\n1. **Not an item**\n\`\`\`\n`;
    const underDone = `✅ **Done:**${BR}\n1. **Fixed it**\n   \`\`\`\n📌 **Outstanding from previous turns:**\n   \`\`\`\n👉 **Todo:**${BR}\n1. **Run it**\n`;

    expect(itemsOfText(outside)).toEqual([]);
    expect(itemsOfText(underDone).map((item) => item.isPinned)).toEqual([false]);
  });

  test("a topic's title, the line above its rule, is no part of the item above it", () => {
    const text = `👉 **Todo:**${BR}\n1. **Run the benchmark**${BR}\nThe loader\n═══════════\n`;

    expect(itemsOfText(text).map((item) => item.line)).toEqual(["**Run the benchmark**"]);
  });

  test("a line after a separator is no body of the summary alone above it", () => {
    const text = `👉 **Todo:**${BR}\n1. **Run it**${BR}\n   ${SEP}\n   Its sentence.\n`;

    expect(itemsOfText(text).map((item) => item.line)).toEqual(["**Run it**"]);
  });

  test("a CRLF reply's items are its LF form's", () => {
    expect(itemsOfText(ITEMS_REPLY.replaceAll("\n", "\r\n"))).toEqual(itemsOfText(ITEMS_REPLY));
  });
});

describe("decideItemsOfText, as parseReply reads a reply", () => {
  const OPTIONED = `1. **Which cache to keep**${BR}\n   🔘 A. **Disk**`;

  test("a numbered line 3 spaces in is under the item above, no item of its own", () => {
    expect(decideItemsOfText(`🧠 **Decide:**${BR}\n${OPTIONED}\n   2. **Nested**\n      🔘 A. **Disk**`)).toEqual([
      { number: 1, summary: "Which cache to keep" },
    ]);
  });

  test("an item's options are read up to the next item: after blank lines, under a later bullet or a later plain item", () => {
    for (const text of [
      `🧠 **Decide:**${BR}\n1. **Which cache to keep**${BR}\n\n   🔘 A. **Disk**`,
      `🧠 **Decide:**${BR}\n1. **Which cache to keep**${BR}\n\n\n   It still reads twice.\n\n   🔘 A. **Disk**`,
      `🧠 **Decide:**${BR}\n1. **Which cache to keep**${BR}\n- **A bullet**\n   🔘 A. **Disk**`,
      `🧠 **Decide:**${BR}\n1. **Which cache to keep**${BR}\n\n- **A bullet**\n\n   🔘 A. **Disk**`,
      `🧠 **Decide:**${BR}\n1. **Which cache to keep**${BR}\n2. Plain words\n   🔘 A. **Disk**`,
    ]) {
      expect(decideItemsOfText(text)).toEqual([{ number: 1, summary: "Which cache to keep" }]);
    }
  });

  test("an option goes to the nearest item above it, and an item with none below it before the next is none", () => {
    expect(
      decideItemsOfText(`🧠 **Decide:**${BR}\n1. **Which cache to keep**${BR}\n\n2. **Ship it**${BR}\n\n   🔘 A. **Disk**`),
    ).toEqual([{ number: 2, summary: "Ship it" }]);
  });

  test("a number alone on its line opens an item, its bold summary on the next line not blank", () => {
    for (const text of [
      `🧠 **Decide:**${BR}\n1.\n**Which cache to keep**\n   🔘 A. **Disk**`,
      `🧠 **Decide:**${BR}\n1. \n\n   **Which cache to keep**\n   🔘 A. **Disk**`,
      `🧠 **Decide:**${BR}\n1)\n**Which cache to keep**: why\n\n   🔘 A. **Disk**`,
    ]) {
      expect(decideItemsOfText(text)).toEqual([{ number: 1, summary: "Which cache to keep" }]);
    }
    expect(decideItemsOfText(`🧠 **Decide:**${BR}\n1.\nPlain **bold**\n   🔘 A. **Disk**`)).toEqual([]);
  });

  test("an option or an item inside code is none, and an older roll-up header bare ends the list", () => {
    for (const text of [
      `🧠 **Decide:**${BR}\n1. **Which cache to keep**${BR}\n   \`\`\`\n   🔘 A. **Disk**\n   \`\`\``,
      `🧠 **Decide:**${BR}\n1. **Which cache to keep**${BR}\n\n\`\`\`\n   🔘 A. **Disk**\n\`\`\``,
      `🧠 **Decide:**${BR}\n\`\`\`\n1. **Which cache to keep**${BR}\n\`\`\`\n   🔘 A. **Disk**`,
      `🧠 **Decide:**${BR}\n1. **Which cache to keep**${BR}\nStill open from earlier\n   🔘 A. **Disk**`,
    ]) {
      expect(decideItemsOfText(text)).toEqual([]);
    }
  });

  test("a Decide list inside a code block is code", () => {
    expect(decideItemsOfText(`\`\`\`\n🧠 **Decide:**${BR}\n${OPTIONED}\n\`\`\``)).toEqual([]);
  });
});
