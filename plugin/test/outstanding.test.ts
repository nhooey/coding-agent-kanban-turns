// What earlier turns left open: the kanban skill's test_outstanding.py, on
// neutral turns built directly, with the Decide items raised by the turns'
// `kanban_options` calls; and what settles each list's items.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  allItems,
  answeredSubjects,
  answersOfLine,
  countLine,
  decideItemsOfText,
  decideStates,
  itemsOfText,
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
  subjectKey,
  summaryOf,
  unsettled,
  windowStart,
} from "../src/outstanding.ts";
import { itemsOf } from "../src/items.ts";
import type { Owner, Turn } from "../types/index.d.ts";
import { numbered, said, turnOf } from "./turns.ts";

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

  test("an item asked again in a later turn settles as restated", () => {
    expect(
      settlementsOf([
        decided(FIRST),
        turnOf(SECOND, "more", {
          replies: ["restated"],
          decide: itemsOf(decideCall(SECOND, [4], SUMMARIES.slice(0, 1))),
        }),
      ]),
    ).toEqual([{ ref: "9efb08a1.Decide.1", how: "restated" }]);
  });

  test("an open item has none", () => {
    expect(settlementsOf([decided(FIRST)])).toEqual([]);
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
  test("the items of the rolled-up lists and of the 📌 roll-up, the roll-up's tag cut off", () => {
    expect(itemsOfText(ITEMS_REPLY)).toEqual([
      { list: "pending", number: 1, isPinned: false, line: "**Rework the loader** It still reads twice." },
      { list: "pending", number: 2, isPinned: false, line: "**Another one**: with its text beside it" },
      { list: "todo", number: undefined, isPinned: true, line: "**Paste the prompt**" },
    ]);
  });

  test("a topic header is no part of the item above", () => {
    const text =
      "**First topic**  \n═══════════\n👉 **Todo:**  \n▔▔▔▔▔▔▔▔\n1. **Run the benchmark**\n\n**Second topic**  \n════════════\n";
    expect(itemsOfText(text)).toEqual([
      { list: "todo", number: 1, isPinned: false, line: "**Run the benchmark**" },
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

  test("else a branch-shaped code span", () => {
    expect(subjectKey("Merge `README.md` and `atomic-reload` today")).toBe("branch atomic-reload");
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
