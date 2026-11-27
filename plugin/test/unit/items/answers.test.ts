import { describe, test } from "node:test";
import { expect } from "expect";

import {
  choiceTo,
  choose,
  REASSESS_LINE,
  draftHeader,
  hasReassess,
  headed,
  isAnswered,
  lettersFor,
  noteFor,
  reassessKept,
  toggledReassess,
  withNote,
} from "../../../src/items/answers.ts";
import { asksQuestion } from "../../../src/items/answer-lines.ts";
import { isSameTurn, reraisable } from "../../../src/items/items.ts";
import { codeSpans } from "../../../src/views/layout.ts";
import {
  itemOfLink,
  itemOfRef,
  linkedItems,
  linkedSummaries,
  refOfLink,
} from "../../../src/views/links.ts";
import type { DecideItem } from "../../../types/index.d.ts";

const radio: DecideItem = {
  turn: "9efb08a1",
  list: "Decide",
  number: 1,
  summary: "Which cache to keep",
  kind: "radio",
  ref: "9efb08a1.Decide.1",
  options: [
    { letter: "A", name: "Disk" },
    { letter: "B", name: "Memory" },
  ],
};
const checkbox: DecideItem = {
  ...radio,
  number: 2,
  summary: "Cleanups to start",
  kind: "checkbox",
  ref: "9efb08a1.Decide.2",
  options: [
    { letter: "A", name: "Matchers" },
    { letter: "B", name: "Dead code" },
    { letter: "C", name: "Stale render" },
  ],
};
const yesOrNo: DecideItem = {
  ...radio,
  number: 3,
  summary: "Ship tonight?",
  ref: "9efb08a1.Decide.3",
  options: [
    { letter: "Y", name: "Ship" },
    { letter: "N", name: "Hold" },
  ],
};
const items = [radio, checkbox, yesOrNo];

describe("building and replacing references in the draft", () => {
  test("a click on an empty draft writes the reference on its own line", () => {
    expect(choose("", radio, "A")).toBe("9efb08a1.Decide.1.A\n");
  });

  test("a click puts the reference on a line of its own after what the person typed", () => {
    expect(choose("Go ahead:", radio, "B")).toBe(
      "Go ahead:\n9efb08a1.Decide.1.B\n",
    );
    expect(choose("Go ahead: ", radio, "B")).toBe(
      "Go ahead:\n9efb08a1.Decide.1.B\n",
    );
  });

  test("a draft already ending its line gains no blank line", () => {
    expect(choose("Go ahead:\n", radio, "B")).toBe(
      "Go ahead:\n9efb08a1.Decide.1.B\n",
    );
  });

  test("a second click on the chosen option takes its answer out", () => {
    const once = choose("Go ahead: ", radio, "A");
    expect(choose(once, radio, "A")).toBe("Go ahead:\n");
    expect(choose(choose("", yesOrNo, "Y"), yesOrNo, "Y")).toBe("");
  });

  test("a second click keeps the answer's note, without a letter", () => {
    expect(choose("9efb08a1.Decide.1.A: soon", radio, "A")).toBe(
      "9efb08a1.Decide.1: soon",
    );
  });

  test("each click on another item adds a line of its own", () => {
    const once = choose("", radio, "A");
    expect(choose(once, yesOrNo, "Y")).toBe(
      "9efb08a1.Decide.1.A\n9efb08a1.Decide.3.Y\n",
    );
  });

  test("another option of an answered item replaces its reference in place", () => {
    const draft = "x 9efb08a1.Decide.1.A y 9efb08a1.Decide.3.Y";
    expect(choose(draft, radio, "B")).toBe(
      "x 9efb08a1.Decide.1.B y 9efb08a1.Decide.3.Y",
    );
  });

  test("a reference typed with a shorter turn id is found and replaced", () => {
    expect(choose("9efb08a.Decide.3.Y", yesOrNo, "N")).toBe(
      "9efb08a1.Decide.3.N",
    );
  });


  test("an item of another turn with the same number is not touched", () => {
    expect(choose("0f311c94.Decide.1.A", radio, "B")).toBe(
      "0f311c94.Decide.1.A\n9efb08a1.Decide.1.B\n",
    );
  });

  test("the letters a draft picks are read back", () => {
    expect(lettersFor("9efb08a1.Decide.2.A,C", checkbox)).toEqual(["A", "C"]);
    expect(lettersFor("nothing here", checkbox)).toEqual([]);
  });
});

describe("the line naming the plugin", () => {
  const header = draftHeader("coding-agent-kanban-turns@nix-pinned");
  const click = (draft: string, item: DecideItem, letter: string) =>
    headed(draft, header, (body) => choose(body, item, letter));

  test("is the plugin's id and a colon", () => {
    expect(header).toBe("coding-agent-kanban-turns@nix-pinned:");
    expect(draftHeader("coding-agent-kanban-turns")).toBe("coding-agent-kanban-turns:");
  });

  test("opens a draft a click starts in an empty box", () => {
    expect(click("", radio, "A")).toBe(
      "coding-agent-kanban-turns@nix-pinned:\n9efb08a1.Decide.1.A\n",
    );
  });

  test("stays first, once, as later clicks and notes write", () => {
    const first = click("", radio, "A");
    const second = click(first, checkbox, "C");
    expect(second).toBe(
      "coding-agent-kanban-turns@nix-pinned:\n9efb08a1.Decide.1.A\n9efb08a1.Decide.2.C\n",
    );
    expect(headed(second, header, (body) => withNote(body, radio, "only the loader"))).toBe(
      "coding-agent-kanban-turns@nix-pinned:\n9efb08a1.Decide.2.C\n9efb08a1.Decide.1.A: only the loader\n",
    );
  });

  test("goes when the last answer is unpicked, leaving the box empty", () => {
    const one = click("", radio, "A");
    expect(click(one, radio, "A")).toBe("");
    const two = click(click(one, checkbox, "C"), radio, "A");
    expect(click(two, checkbox, "C")).toBe("");
  });

  test("keeps what the person wrote after it", () => {
    const typed = `${click("", radio, "A")}and ship it\n`;
    expect(click(typed, radio, "A")).toBe(
      "coding-agent-kanban-turns@nix-pinned:\nand ship it\n",
    );
  });

  test("is not added to a draft the person began", () => {
    expect(click("go on\n", radio, "B")).toBe("go on\n9efb08a1.Decide.1.B\n");
    expect(click("go on\n9efb08a1.Decide.1.B\n", radio, "B")).toBe("go on\n");
  });
});

describe("the Reassess line", () => {
  const header = draftHeader("coding-agent-kanban-turns");
  const press = (draft: string) => headed(draft, header, toggledReassess);
  const click = (draft: string, item: DecideItem, letter: string) =>
    headed(draft, header, (body) => reassessKept(body, (kept) => choose(kept, item, letter)));

  test("is added as the draft's last line, under the line naming the plugin, and taken out by a second press", () => {
    expect(press("")).toBe("coding-agent-kanban-turns:\nreassess\n");
    expect(press(press(""))).toBe("");
    const picked = click("", radio, "A");
    expect(press(picked)).toBe("coding-agent-kanban-turns:\n9efb08a1.Decide.1.A\nreassess\n");
    expect(press(press(picked))).toBe(picked);
  });

  test("stays last as later clicks and notes write their answers", () => {
    const pressed = press(click("", radio, "A"));
    expect(click(pressed, checkbox, "C")).toBe(
      "coding-agent-kanban-turns:\n9efb08a1.Decide.1.A\n9efb08a1.Decide.2.C\nreassess\n",
    );
    expect(
      headed(pressed, header, (body) => reassessKept(body, (kept) => withNote(kept, radio, "soon"))),
    ).toBe("coding-agent-kanban-turns:\n9efb08a1.Decide.1.A: soon\nreassess\n");
    expect(click(pressed, radio, "A")).toBe("coding-agent-kanban-turns:\nreassess\n");
  });

  test("is found by any of its names, once, alone on the last line", () => {
    expect(hasReassess("9efb08a1.Decide.1.A\nRecheck.\n")).toBe(true);
    expect(hasReassess("reassess")).toBe(true);
    expect(hasReassess("reassess\n9efb08a1.Decide.1.A\n")).toBe(false);
    expect(hasReassess("please reassess\n")).toBe(false);
    expect(hasReassess("")).toBe(false);
    expect(REASSESS_LINE).toBe("reassess");
  });
});

describe("notes and answers in words", () => {
  test("a note follows the item's letters, on a line of its own", () => {
    const draft = choose("9efb08a1.Decide.3.Y", radio, "B");
    expect(withNote(draft, radio, "only for the loader")).toBe(
      "9efb08a1.Decide.3.Y\n9efb08a1.Decide.1.B: only for the loader\n",
    );
  });

  test("a note with no letter answers the item in words", () => {
    const draft = withNote("", radio, "I'd rather wait");
    expect(draft).toBe("9efb08a1.Decide.1: I'd rather wait\n");
    expect(isAnswered(draft, radio)).toBe(true);
    expect(lettersFor(draft, radio)).toEqual([]);
    expect(noteFor(draft, radio)).toBe("I'd rather wait");
  });

  test("a note opening on a one-letter word is not read as that option", () => {
    expect(lettersFor("9efb08a1.Decide.1: A red one", radio)).toEqual([]);
    expect(noteFor("9efb08a1.Decide.1: A red one", radio)).toBe("A red one");
  });

  test("letters alone after the colon are the letters written the other way", () => {
    expect(lettersFor("9efb08a1.Decide.2: A, C", checkbox)).toEqual(["A", "C"]);
    expect(noteFor("9efb08a1.Decide.2: A, C", checkbox)).toBe("");
  });

  test("another letter keeps the note, and a click after a note starts a new line", () => {
    const noted = withNote("", radio, "for now");
    expect(choose(noted, radio, "A")).toBe("9efb08a1.Decide.1.A: for now\n");
    expect(choose(noted, yesOrNo, "N")).toBe(
      "9efb08a1.Decide.1: for now\n9efb08a1.Decide.3.N\n",
    );
  });

  test("an empty note keeps the letters, and drops an answer that was only words", () => {
    expect(withNote("9efb08a1.Decide.1.A: for now", radio, "")).toBe(
      "9efb08a1.Decide.1.A",
    );
    expect(withNote("ok\n9efb08a1.Decide.1: for now", radio, " ")).toBe("ok");
    expect(withNote("ok\n9efb08a1.Decide.1: for now\n", radio, " ")).toBe(
      "ok\n",
    );
  });

  test("a note for an answer mid-draft moves it to a line of its own at the end", () => {
    expect(
      withNote("9efb08a1.Decide.1.A\n9efb08a1.Decide.3.Y\n", radio, "why"),
    ).toBe("9efb08a1.Decide.3.Y\n9efb08a1.Decide.1.A: why\n");
  });
});

describe("questions in a reply", () => {
  /** The Decide list's header, which a question's summary line sits under to name a Decide item. */
  const DECIDE_HEADER = "🧠 **Decide:**";

  test("an open item's summary line becomes a link to it, and nothing else does", () => {
    const reply = [
      DECIDE_HEADER,
      "1. **Which cache to keep**  ",
      "   Both are built.",
      "2. **Some other question**  ",
    ].join("\n");
    const linked = linkedSummaries(reply, items);

    expect(linked.hrefs).toEqual([
      "https://kanban-turns.invalid/9efb08a1.Decide.1",
    ]);
    expect(linked.text.split("\n")[1]).toBe(
      "1. **[Which cache to keep](https://kanban-turns.invalid/9efb08a1.Decide.1)**  ",
    );
    expect(linked.text.split("\n").slice(2)).toEqual(
      reply.split("\n").slice(2),
    );
    // Under no list's header, the same line names nothing.
    expect(linkedSummaries(reply.split("\n").slice(1).join("\n"), items).hrefs).toEqual([]);
    expect(itemOfLink(items, linked.hrefs[0] ?? "")).toBe(0);
    expect(itemOfLink(items, "https://example.com/")).toBe(-1);
    expect(refOfLink(linked.hrefs[0] ?? "")).toBe("9efb08a1.Decide.1");
    expect(refOfLink("https://example.com/9efb08a1.Decide.1")).toBe("");
  });

  test("the item a ref names, by its place, -1 for none", () => {
    expect(itemOfRef(items, "9efb08a1.Decide.3")).toBe(2);
    expect(itemOfRef(items, "9efb08a1.Decide.9")).toBe(-1);
    expect(itemOfRef(items, "")).toBe(-1);
  });

  test("a Todo item a ref names, among the Decide items, by its place", () => {
    const todo = {
      turn: "9efb08a1",
      list: "Todo",
      number: 3,
      summary: "Rotate the deploy token",
      ref: "9efb08a1.Todo.3",
    } as const;

    expect(itemOfRef([...items, todo], "9efb08a1.Todo.3")).toBe(items.length);
    expect(itemOfRef([...items, todo], "9efb08a1.Decide.3")).toBe(2);
  });

  test("the items a reply links, once each, in the reply's order", () => {
    const hrefs = [
      "https://kanban-turns.invalid/9efb08a1.Decide.3",
      "https://kanban-turns.invalid/9efb08a1.Decide.1",
      "https://kanban-turns.invalid/9efb08a1.Decide.3",
      "https://example.com/",
    ];
    expect(linkedItems(items, hrefs)).toEqual([yesOrNo, radio]);
    expect(linkedItems(items, [])).toEqual([]);
  });

  test("a summary line is a numbered item's own line, `1.` or `1)`, not one under another item or inside code", () => {
    const LINK = "https://kanban-turns.invalid/9efb08a1.Decide.1";

    const under = (text: string) => linkedSummaries(`${DECIDE_HEADER}\n${text}`, items).hrefs;

    expect(under("1) **Which cache to keep**")).toEqual([LINK]);
    expect(under("2. **Other**\n   1. **Which cache to keep**")).toEqual([]);
    expect(under("```\n1. **Which cache to keep**\n```")).toEqual([]);
    expect(under("1.\n**Which cache to keep**")).toEqual([]);
  });

  test("a CRLF reply's summary line keeps its line end", () => {
    expect(linkedSummaries(`${DECIDE_HEADER}\r\n1. **Which cache to keep**  \r\nmore`, items).text).toBe(
      `${DECIDE_HEADER}\r\n1. **[Which cache to keep](https://kanban-turns.invalid/9efb08a1.Decide.1)**  \r\nmore`,
    );
  });
});

describe("checkbox items", () => {
  test("a second letter joins the first, in option order", () => {
    const once = choose("", checkbox, "C");
    expect(once).toBe("9efb08a1.Decide.2.C\n");
    expect(choose(once, checkbox, "A")).toBe("9efb08a1.Decide.2.A,C\n");
  });

  test("a letter clicked again is taken out", () => {
    expect(choose("9efb08a1.Decide.2.A,C", checkbox, "A")).toBe(
      "9efb08a1.Decide.2.C",
    );
  });

  test("the last letter taken out drops the reference and its space", () => {
    expect(choose("ok 9efb08a1.Decide.2.B thanks", checkbox, "B")).toBe(
      "ok thanks",
    );
    expect(choose("ok 9efb08a1.Decide.2.B", checkbox, "B")).toBe("ok");
    expect(choose("ok 9efb08a1.Decide.2.B\nthanks", checkbox, "B")).toBe(
      "ok\nthanks",
    );
  });

  test("the last letter taken out of an answer on its own line leaves no blank line", () => {
    expect(choose("9efb08a1.Decide.2.B\n", checkbox, "B")).toBe("");
    expect(
      choose("ok\n9efb08a1.Decide.2.B\n9efb08a1.Decide.3.Y\n", checkbox, "B"),
    ).toBe("ok\n9efb08a1.Decide.3.Y\n");
    expect(choose("ok\n9efb08a1.Decide.2.B\n", checkbox, "B")).toBe("ok\n");
  });
});

describe("an item's text", () => {
  test("code spans split at backticks and lose their bold marks", () => {
    expect(codeSpans("Keep **`old-forks`** as is")).toEqual([
      { text: "Keep ", isCode: false },
      { text: "old-forks", isCode: true },
      { text: " as is", isCode: false },
    ]);
  });
});

describe("the items a kanban_options call hands over", () => {
  test("an open item handed back to raise again leaves out its supersedes, and keeps the rest", () => {
    const item: DecideItem = { ...radio, ref: "9efb08a1.Decide.1", supersedes: ["682e71fb.Decide.1"] };
    const again = reraisable(item);

    expect("supersedes" in again).toBe(false);
    expect(again).toEqual({ ...radio, ref: "9efb08a1.Decide.1" });
  });

  test("two turn ids name one turn where either is a prefix of the other, and an empty one names none", () => {
    expect(isSameTurn("9efb08a1", "9efb08")).toBe(true);
    expect(isSameTurn("9efb08", "9efb08a1")).toBe(true);
    expect(isSameTurn("9efb08a1", "b2c3d4e5")).toBe(false);
    expect(isSameTurn("", "9efb08a1")).toBe(false);
    expect(isSameTurn("9efb08a1", "")).toBe(false);
  });
});

describe("an answer that picks", () => {
  test("is the draft's answer to the item, unless its line asks a question", () => {
    expect(choiceTo("9efb08a1.Decide.1.B\n", radio)?.letters).toEqual(["B"]);
    expect(choiceTo("9efb08a1.Decide.1: later\n", radio)?.note).toBe("later");
    expect(choiceTo("9efb08a1.Decide.1: how would B work?\n", radio)).toBeUndefined();
    expect(choiceTo("Why? 9efb08a1.Decide.1.A", radio)).toBeUndefined();
    expect(choiceTo("9efb08a1.Decide.2: why?\n9efb08a1.Decide.1.A\n", radio)?.letters).toEqual(["A"]);
    expect(choiceTo("", radio)).toBeUndefined();
  });

  test("is the latest of the item's answers on a line that asks no question, a question before it passed over", () => {
    expect(choiceTo("9efb08a1.Decide.1: why?\n9efb08a1.Decide.1.A\n", radio)?.letters).toEqual(["A"]);
    expect(choiceTo("9efb08a1.Decide.1.A\n9efb08a1.Decide.1.B\n", radio)?.letters).toEqual(["B"]);
    expect(choiceTo("9efb08a1.Decide.1.A\n9efb08a1.Decide.1: but why?\n", radio)?.letters).toEqual(["A"]);
  });

  test("a line asks a question where it holds a question mark", () => {
    expect(asksQuestion("Decide.1?")).toBe(true);
    expect(asksQuestion("9efb08a1.Decide.1.B: why not C?")).toBe(true);
    expect(asksQuestion("9efb08a1.Decide.1.B: only the loader")).toBe(false);
  });
});
