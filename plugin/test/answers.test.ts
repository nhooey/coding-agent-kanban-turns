import { describe, test } from "node:test";
import { expect } from "expect";

import {
  choose,
  isAnswered,
  lettersFor,
  noteFor,
  withNote,
} from "../src/answers.ts";
import { itemsOf } from "../src/items.ts";
import { codeSpans } from "../src/layout.ts";
import { itemOfLink, linkedItems, linkedQuestions } from "../src/links.ts";
import type { DecideItem } from "../types/index.d.ts";

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
const binary: DecideItem = {
  ...radio,
  number: 3,
  summary: "Ship tonight?",
  kind: "binary",
  ref: "9efb08a1.Decide.3",
  options: [
    { letter: "Y", name: "Ship" },
    { letter: "N", name: "Hold" },
  ],
};
const items = [radio, checkbox, binary];

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
    expect(choose(choose("", binary, "Y"), binary, "Y")).toBe("");
  });

  test("a second click keeps the answer's note, without a letter", () => {
    expect(choose("9efb08a1.Decide.1.A: soon", radio, "A")).toBe(
      "9efb08a1.Decide.1: soon",
    );
  });

  test("each click on another item adds a line of its own", () => {
    const once = choose("", radio, "A");
    expect(choose(once, binary, "Y")).toBe(
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
    expect(choose("9efb08a.Decide.3.Y", binary, "N")).toBe(
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
    expect(choose(noted, binary, "N")).toBe(
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
  test("an open item's summary line becomes a link to it, and nothing else does", () => {
    const reply = [
      "1. **Which cache to keep**  ",
      "   Both are built.",
      "2. **Some other question**  ",
    ].join("\n");
    const linked = linkedQuestions(reply, items);

    expect(linked.hrefs).toEqual([
      "https://kanban-turns.invalid/9efb08a1.Decide.1",
    ]);
    expect(linked.text.split("\n")[0]).toBe(
      "1. **[Which cache to keep](https://kanban-turns.invalid/9efb08a1.Decide.1)**  ",
    );
    expect(linked.text.split("\n").slice(1)).toEqual(
      reply.split("\n").slice(1),
    );
    expect(itemOfLink(items, linked.hrefs[0] ?? "")).toBe(0);
    expect(itemOfLink(items, "https://example.com/")).toBe(-1);
  });

  test("the items a reply links, once each, in the reply's order", () => {
    const hrefs = [
      "https://kanban-turns.invalid/9efb08a1.Decide.3",
      "https://kanban-turns.invalid/9efb08a1.Decide.1",
      "https://kanban-turns.invalid/9efb08a1.Decide.3",
      "https://example.com/",
    ];
    expect(linkedItems(items, hrefs)).toEqual([binary, radio]);
    expect(linkedItems(items, [])).toEqual([]);
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
  test("a ref and a kind left out are filled in, and a malformed item dropped", () => {
    const found = itemsOf({
      items: [
        {
          turn: "abc12345",
          number: 4,
          summary: "S",
          options: [{ letter: "A", name: "a" }],
        },
        { turn: 1 },
      ],
    });
    expect(found).toEqual([
      {
        turn: "abc12345",
        list: "Decide",
        number: 4,
        summary: "S",
        kind: "radio",
        ref: "abc12345.Decide.4",
        options: [{ letter: "A", name: "a" }],
      },
    ]);
  });
});
