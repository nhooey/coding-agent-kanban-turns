// What the hooks draw: the commands' and the tool's text, an item's title,
// what Submit does with the draft, an item's notes, and when the tool's row
// draws nothing.

import { describe, test } from "node:test";
import { expect } from "expect";

import { emptyRaised } from "../../../src/items/raised.ts";
import {
  NEEDS_ENTER_TEXT,
  answersText,
  configText,
  drewText,
  gutterStyle,
  answeredText,
  draftSummary,
  keyRows,
  isPlainToolRow,
  itemTitle,
  noItemsText,
  needsEnter,
  markCells,
  noteRows,
  notPutBackText,
  optionLead,
  failedText,
  notSentText,
  notesKey,
  putBackText,
  notesMode,
  pickedText,
  sentLetters,
  settledLink,
  settledText,
  submitStep,
  boxLines,
  doneRowOf,
  supersedesLinks,
} from "../../../src/pane/view.ts";
import type { SettledTexts } from "../../../src/pane/view.ts";
import type { DecideItem, Raised, Settlement, TodoItem } from "../../../types/index.d.ts";
import { SETTINGS } from "../../fixtures/settings.ts";
import { openItems } from "../../fixtures/raised.ts";

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
const binary: DecideItem = {
  ...radio,
  number: 2,
  kind: "binary",
  ref: "",
  options: [
    { letter: "Y", name: "Ship" },
    { letter: "N", name: "Hold" },
  ],
};
const raised: Raised = { ...emptyRaised, items: openItems([radio, binary]) };
const SETTLED = { tag: "settled" } as const;
const OPEN = { tag: "open" } as const;

describe("the text with no open items", () => {
  test("says why when the reason is known, naming no list, since the pane holds every list's", () => {
    expect(noItemsText("")).toBe("No open items.");
    expect(noItemsText("no script")).toBe("No open items: no script.");
  });
});

describe("/answers's reply", () => {
  test("counts the open items the pane opened over, the settled left out, the pane named for no list", () => {
    expect(answersText(raised)).toBe("Kanban pane opened: 2 open Decide items.");
    expect(
      answersText({ ...raised, items: [{ item: radio, state: SETTLED }, { item: binary, state: OPEN }] }),
    ).toBe(
      "Kanban pane opened: 1 open Decide items.",
    );
  });

  test("counts every open item, a Todo item's too, list by list in the pane's order, a list with none left out", () => {
    const todo: TodoItem = {
      turn: "9efb08a1",
      list: "Todo",
      number: 1,
      summary: "Rotate the deploy token",
      ref: "9efb08a1.Todo.1",
    };

    expect(answersText({ ...emptyRaised, items: openItems([todo]) })).toBe(
      "Kanban pane opened: 1 open Todo items.",
    );
    expect(answersText({ ...raised, items: openItems([radio, binary, todo]) })).toBe(
      "Kanban pane opened: 1 open Todo items, 2 open Decide items.",
    );
  });

  test("says there are none, and why", () => {
    expect(answersText({ ...emptyRaised, problem: "it broke" })).toBe(
      "No open items: it broke.",
    );
    expect(
      answersText({ ...raised, items: [{ item: radio, state: SETTLED }, { item: binary, state: SETTLED }] }),
    ).toBe("No open items.");
  });
});

describe("/answers-config's reply", () => {
  test("lists the settings in effect, then what wasn't used", () => {
    expect(
      configText(
        ["keys.help = h", "colors.title = claude"],
        ["bad.yaml: parse error"],
      ),
    ).toBe(
      "keys.help = h\ncolors.title = claude\nNot used: bad.yaml: parse error",
    );
  });

  test("is empty with nothing to list", () => {
    expect(configText([], [])).toBe("");
  });
});

describe("the tool's result", () => {
  test("names each item drawn by its reference, filling a missing one", () => {
    expect(drewText([radio, binary])).toBe(
      "Drew buttons for 2 Decide items under the final response and in the Kanban pane: 9efb08a1.Decide.1, 9efb08a1.Decide.2.",
    );
  });

  test("then says what it ignored of each item's supersedes, as naming no Decide item", () => {
    expect(
      drewText(
        [radio, binary],
        [{ ref: "9efb08a1.Decide.2", values: [`"Decide.1"`, `"682e71fb.Todo.1"`, "7"], left: "some" }],
      ),
    ).toBe(
      "Drew buttons for 2 Decide items under the final response and in the Kanban pane: 9efb08a1.Decide.1, 9efb08a1.Decide.2." +
        ` Ignored in 9efb08a1.Decide.2's supersedes, as no Decide item's reference, <turn>.Decide.<n>: "Decide.1", "682e71fb.Todo.1", 7.`,
    );
  });

  test("says an item whose supersedes it ignored whole replaces an earlier item on its subject, and names the list's form where it was no list", () => {
    const drew =
      "Drew buttons for 1 Decide items under the final response and in the Kanban pane: 9efb08a1.Decide.1.";

    expect(drewText([radio], [{ ref: "9efb08a1.Decide.1", values: [`"Decide.1"`], left: "all" }])).toBe(
      `${drew} Ignored all of 9efb08a1.Decide.1's supersedes, as no Decide item's reference, <turn>.Decide.<n>: "Decide.1";` +
        " so it replaces an earlier item on its subject, as with no supersedes.",
    );
    expect(drewText([radio], [{ ref: "9efb08a1.Decide.1", values: [`"682e71fb.Decide.1"`], left: "list" }])).toBe(
      `${drew} Ignored 9efb08a1.Decide.1's supersedes, "682e71fb.Decide.1", as no list, ["<turn>.Decide.<n>"];` +
        " so it replaces an earlier item on its subject, as with no supersedes.",
    );
  });
});

describe("an item's title", () => {
  test("is a label of its list and number, padded for its background, then its summary, marked when Done", () => {
    expect(itemTitle(radio, false)).toEqual({
      label: " 🧠 Decide.1 ",
      summary: "Which cache to keep",
    });
    expect(itemTitle(radio, true)).toEqual({
      label: " 🧠 Decide.1 ",
      summary: "Which cache to keep (done)",
    });
  });
});

describe("what made an item Done", () => {
  test("is the answer: the turn it was sent in, its letters, then its note", () => {
    const answered = { ref: "9efb08a1.Decide.1", how: "answered", turn: "4a2206b0", note: "" } as const;
    expect(settledText({ ...answered, letters: ["Y"] })).toBe("Answered in 4a2206b0: Y");
    expect(settledText({ ...answered, letters: ["A", "C"], note: "the loader" })).toBe(
      "Answered in 4a2206b0: A,C · the loader",
    );
    expect(settledText({ ...answered, letters: [], note: "not yet" })).toBe("Answered in 4a2206b0: not yet");
    expect(sentLetters({ ...answered, letters: ["A", "C"] })).toEqual(["A", "C"]);
  });

  test("says so when a reassess, the item that superseded it, or nothing the transcript says made it Done", () => {
    expect(settledText({ ref: "r", how: "reassessed" })).toBe("Done: reassessed");
    expect(settledText({ ref: "r", how: "superseded", by: "5b4b0642.Decide.1" })).toBe(
      "Superseded by 5b4b0642.Decide.1",
    );
    expect(settledText(undefined)).toBe("Done");
    expect(sentLetters({ ref: "r", how: "reassessed" })).toEqual([]);
    expect(sentLetters({ ref: "r", how: "superseded", by: "5b4b0642.Decide.1" })).toEqual([]);
    expect(sentLetters(undefined)).toEqual([]);
  });

  test("is a link to the item that superseded it, and no link for any other way", () => {
    const superseded = { ref: "682e71fb.Decide.1", how: "superseded", by: "5b4b0642.Decide.1" } as const;
    expect(settledLink(superseded)).toEqual({ text: "Superseded by 5b4b0642.Decide.1", to: "5b4b0642.Decide.1" });
    expect(settledLink({ ref: "r", how: "reassessed" })).toBeUndefined();
    expect(settledLink({ ref: "r", how: "sent", letters: ["A"], note: "" })).toBeUndefined();
    expect(settledLink(undefined)).toBeUndefined();
  });

  test("is the answer Submit sent, until the turn's end reads it", () => {
    const sent = { ref: "r", how: "sent", letters: ["B"], note: "" } as const;
    expect(settledText(sent)).toBe("Sent: B");
    expect(settledText({ ...sent, note: "only the loader" })).toBe("Sent: B · only the loader");
    expect(sentLetters(sent)).toEqual(["B"]);
  });

  test("has a text for every way an item settles, which the type checker holds it to", () => {
    // `npm run typecheck` checks this: a table of texts missing a `how` is
    // refused, so a `how` added to `Settlement` without its text is a
    // compile error, not a line that says something else.
    const lacking: Omit<SettledTexts, "superseded"> = {
      answered: () => "",
      sent: () => "",
      reassessed: () => "",
      worded: () => "",
      "sent-word": () => "",
    };
    // @ts-expect-error `superseded` has no text.
    const missing: SettledTexts = lacking;
    const every: Record<Settlement["how"], true> = {
      answered: true,
      sent: true,
      reassessed: true,
      superseded: true,
      worded: true,
      "sent-word": true,
    };
    const hows = Object.keys(every) as readonly Settlement["how"][];

    expect(missing).toBe(lacking);
    expect(
      hows.map((how) =>
        settledText({
          ref: "r",
          how,
          turn: "4a2206b0",
          letters: [],
          word: "done",
          note: "",
          by: "5b4b0642.Decide.1",
        } as Settlement),
      ),
    ).toEqual([
      "Answered in 4a2206b0: ",
      "Sent: ",
      "Done: reassessed",
      "Superseded by 5b4b0642.Decide.1",
      "Done: done",
      "Sent: done",
    ]);
  });
});

describe("a Done item's row", () => {
  test("ends on what made it Done, or, where that's a link, stops before it, for the link to follow", () => {
    const sent = { ref: "9efb08a1.Decide.1", how: "sent", letters: ["A"], note: "" } as const;
    const superseded = { ref: "9efb08a1.Decide.1", how: "superseded", by: "5b4b0642.Decide.1" } as const;
    expect(doneRowOf(radio, sent)).toEqual({
      line: { label: "🧠 Decide.1", text: "Which cache to keep · Sent: A" },
      link: undefined,
    });
    expect(doneRowOf(radio, superseded)).toEqual({
      line: { label: "🧠 Decide.1", text: "Which cache to keep · " },
      link: { text: "Superseded by 5b4b0642.Decide.1", to: "5b4b0642.Decide.1" },
    });
  });
});

describe("what an item's box says of where it stands", () => {
  const superseded = { ref: "9efb08a1.Decide.1", how: "superseded", by: "5b4b0642.Decide.1" } as const;

  test("a Done item's line saying what made it Done, and no link, where that's no link", () => {
    expect(boxLines(true, { ref: "r", how: "reassessed" }, [])).toEqual({ settled: "Done: reassessed", links: [] });
    expect(boxLines(true, undefined, [])).toEqual({ settled: "Done", links: [] });
  });

  test("a superseded item's link to the item that superseded it, in place of the line", () => {
    expect(boxLines(true, superseded, [])).toEqual({
      settled: "",
      links: [{ text: "Superseded by 5b4b0642.Decide.1", to: "5b4b0642.Decide.1" }],
    });
  });

  test("a link to each item it supersedes, open or Done, after any link of its own", () => {
    expect(boxLines(false, undefined, ["682e71fb.Decide.1", "682e71fb.Decide.2"])).toEqual({
      settled: "",
      links: [
        { text: "Supersedes 682e71fb.Decide.1", to: "682e71fb.Decide.1" },
        { text: "Supersedes 682e71fb.Decide.2", to: "682e71fb.Decide.2" },
      ],
    });
    expect(boxLines(true, superseded, ["682e71fb.Decide.1"]).links.map((link) => link.to)).toEqual([
      "5b4b0642.Decide.1",
      "682e71fb.Decide.1",
    ]);
  });

  test("nothing for an open item that supersedes none, whatever settlement it's handed", () => {
    expect(boxLines(false, superseded, [])).toEqual({ settled: "", links: [] });
    expect(supersedesLinks([])).toEqual([]);
  });
});

describe("a plain tool row", () => {
  const plain = { isExpanded: false, isErrored: false, isInterrupted: false, itemCount: 2 };

  test("is a row that drew items with nothing more to say", () => {
    expect(isPlainToolRow(plain)).toBe(true);
  });

  test("is not one under ctrl+o, errored, interrupted or with no items", () => {
    expect(isPlainToolRow({ ...plain, isExpanded: true })).toBe(false);
    expect(isPlainToolRow({ ...plain, isErrored: true })).toBe(false);
    expect(isPlainToolRow({ ...plain, isInterrupted: true })).toBe(false);
    expect(isPlainToolRow({ ...plain, itemCount: 0 })).toBe(false);
  });

  test("a result line, without an interruption or a count, is plain unless expanded or errored", () => {
    expect(isPlainToolRow({ isExpanded: false, isErrored: false })).toBe(true);
    expect(isPlainToolRow({ isExpanded: true, isErrored: false })).toBe(false);
    expect(isPlainToolRow({ isExpanded: false, isErrored: true })).toBe(false);
  });
});

describe("the pane's Submit", () => {
  test("sends the draft as it is", () => {
    expect(submitStep("9efb08a1.Decide.1.A\n", false)).toEqual({
      send: "9efb08a1.Decide.1.A\n",
    });
  });

  test("does nothing for an empty or blank draft, or one of the line naming the plugin alone", () => {
    for (const draft of ["", "  \n\t", "coding-agent-kanban-turns:\n", "coding-agent-kanban-turns@nix-pinned:\n  \n"]) {
      expect(submitStep(draft, false)).toEqual({ skip: true });
    }
  });

  test("sends a draft of the line naming the plugin and a reassess line", () => {
    expect(submitStep("coding-agent-kanban-turns:\nreassess\n", false)).toEqual({
      send: "coding-agent-kanban-turns:\nreassess\n",
    });
  });

  test("does nothing while a turn runs or another Submit is under way", () => {
    expect(submitStep("9efb08a1.Decide.1.A\n", true)).toEqual({ skip: true });
  });

  test("keeps a draft with a file mention, pasted text or an image in the box, saying to press Enter", () => {
    for (const draft of [
      "9efb08a1.Decide.1: see @src/a.ts",
      "Decide.1: like [Image #1]",
      "Decide.1: the log\n[Pasted text #2 +40 lines]",
    ]) {
      expect(submitStep(draft, false)).toEqual({ refuse: NEEDS_ENTER_TEXT });
    }
    expect(NEEDS_ENTER_TEXT).toContain("press Enter in the prompt to send file mentions, pasted text or images");
  });

  test("says why the engine didn't take the prompt", () => {
    expect(notSentText("a hook refused it")).toBe(
      "Not sent, the draft put back in the prompt box: a hook refused it",
    );
    expect(notSentText("a hook refused it", true)).toBe(
      "Not sent, the draft put back in the prompt box after the text typed meanwhile: a hook refused it",
    );
  });

  test("gives the draft itself when the box couldn't take it back", () => {
    expect(notPutBackText("a hook refused it", "9efb08a1.Decide.1.B\n")).toBe(
      "Not sent, and the prompt box couldn't take the draft back: a hook refused it\nThe draft, to copy:\n9efb08a1.Decide.1.B\n",
    );
  });

  test("says why Submit failed, with the draft once it has one, as the box may have lost it", () => {
    expect(failedText("boom")).toBe("Submit failed: boom");
    expect(failedText("boom", "9efb08a1.Decide.1.B\n")).toBe(
      "Submit failed, the draft perhaps not sent and the prompt box perhaps emptied: boom\nThe draft, to copy:\n9efb08a1.Decide.1.B\n",
    );
  });

  test("puts the draft back alone into the emptied box, else on its own line after what was typed", () => {
    expect(putBackText("", "1. A\n")).toBe("1. A\n");
    expect(putBackText("more words", "1. A\n")).toBe("\n1. A\n");
    expect(putBackText("more words\n", "1. A\n")).toBe("1. A\n");
  });
});

describe("what a draft needs Enter for", () => {
  test("a mention whose path starts as a path does, is quoted, or ends in an extension", () => {
    for (const draft of [
      "@README.md",
      "Decide.1: read\n@plugin/src/view.ts",
      "Decide.1: see @src/x.ts, then",
      "Decide.1: see @src/x.ts#L3-9",
      "@./x",
      "@../up/x",
      "@~/notes",
      "@/etc/hosts",
      '@"my file.md"',
    ]) {
      expect(needsEnter(draft)).toBe(true);
    }
  });

  test("pasted text or an image left as a placeholder", () => {
    for (const draft of ["[Image #12] here", "[Pasted text #1 +12 lines]", "a\n[Pasted text #3 +1 line]", "[Pasted text #4]"]) {
      expect(needsEnter(draft)).toBe(true);
    }
  });

  test("not a name, a package, an address, a bare @ or plain text", () => {
    for (const draft of [
      "Decide.1: ask @alice",
      "Decide.1: ask @alice.",
      "Decide.1: bump @types/node first",
      "Decide.1: mail me@example.com",
      "Decide.1: the @ sign",
      "9efb08a1.Decide.1.A\n",
      "Decide.1: [Pasted text] in words",
    ]) {
      expect(needsEnter(draft)).toBe(false);
    }
  });
});

describe("an item's notes", () => {
  test("are keyed by the item's reference", () => {
    expect(notesKey(radio)).toBe("9efb08a1.Decide.1.notes");
  });

  test("are none once settled, a button under a reply, else the field", () => {
    const at = { isSettled: false, isPane: true, isNoting: false };
    expect(notesMode({ ...at, isSettled: true })).toBe("none");
    expect(notesMode({ ...at, isSettled: true, isPane: false })).toBe("none");
    expect(notesMode({ ...at, isPane: false })).toBe("button");
    expect(notesMode({ ...at, isPane: false, isNoting: true })).toBe("button");
    expect(notesMode(at)).toBe("field");
  });

  test("take the focus in the pane when their Add a note opened it", () => {
    expect(notesMode({ isSettled: false, isPane: true, isNoting: true })).toBe("focused");
  });
});

describe("the notes field's rows", () => {
  test("are the setting's whole number, at least 1", () => {
    expect(noteRows(3)).toBe(3);
    expect(noteRows(2.7)).toBe(2);
    expect(noteRows(0)).toBe(1);
    expect(noteRows(-4)).toBe(1);
    expect(noteRows(Number.NaN)).toBe(1);
  });
});

describe("the column left of an option", () => {
  const colors = { hover: "suggestion", settled: "ide" };

  const settled = (answered: readonly string[], letter: string) =>
    gutterStyle(
      { isSettled: true, answered, letter, scope: `9efb08a1.Decide.1.${letter}` },
      colors,
    );

  test("lights in the hover colour under the pointer while the item is open, each option in its own scope", () => {
    expect(
      gutterStyle({ isSettled: false, answered: [], letter: "A", scope: "9efb08a1.Decide.1.A" }, colors),
    ).toEqual({
      hover: { scope: "9efb08a1.Decide.1.A", backgroundColor: "suggestion" },
    });
    expect(
      gutterStyle({ isSettled: false, answered: ["A"], letter: "B", scope: "9efb08a1.Decide.1.B" }, colors),
    ).toEqual({
      hover: { scope: "9efb08a1.Decide.1.B", backgroundColor: "suggestion" },
    });
  });

  test("stays lit in the settled colour beside the one answered option, and never hovers", () => {
    expect(settled(["A"], "A")).toEqual({ backgroundColor: "ide" });
    expect(settled(["A"], "B")).toEqual({});
    expect(settled(["A"], "C")).toEqual({});
  });

  test("stays lit beside each of a checkbox item's answered letters, and no other", () => {
    expect(settled(["A", "C"], "A")).toEqual({ backgroundColor: "ide" });
    expect(settled(["A", "C"], "B")).toEqual({});
    expect(settled(["A", "C"], "C")).toEqual({ backgroundColor: "ide" });
  });

  test("lights beside no option of an item settled with no letters", () => {
    expect(settled([], "A")).toEqual({});
    expect(settled([], "B")).toEqual({});
  });

  test("lights beside no option of a superseded item, whose settlement gives no letters", () => {
    const answered = sentLetters({ ref: "9efb08a1.Decide.1", how: "superseded", by: "b2c3d4e5.Decide.1" });

    expect(settled(answered, "A")).toEqual({});
    expect(settled(answered, "B")).toEqual({});
  });
});

describe("what the footer says Submit will send", () => {
  const HEADER = "coding-agent-kanban-turns:\n";

  test("counts the answers and the notes, and names a reassess", () => {
    expect(draftSummary(`${HEADER}9efb08a1.Decide.1.A\n9efb08a1.Decide.2: only the loader\nreassess\n`)).toBe(
      "Draft: 2 answers · 1 note · reassess",
    );
    expect(draftSummary(`${HEADER}9efb08a1.Decide.1.B: and soon\n`)).toBe("Draft: 1 answer · 1 note");
  });

  test("names words of the person's own beside the answers", () => {
    expect(draftSummary("9efb08a1.Decide.1.A\nand rebase first\n")).toBe("Draft: 1 answer · your words");
    expect(draftSummary("just words")).toBe("Draft: your words");
  });

  test("says empty for a box of blanks", () => {
    expect(draftSummary("")).toBe("Draft: empty");
    expect(draftSummary(" \n")).toBe("Draft: empty");
  });
});

describe("how much of what's open the draft answers", () => {
  test("in the pane's header: the open items it answers out of all of them", () => {
    expect(answeredText(1, 3)).toBe("1 of 3 answered");
  });

  test("above the prompt: how many it picks, none while it picks nothing", () => {
    expect(pickedText(2, SETTINGS.marks.note)).toBe("✏️ 2 picked");
    expect(pickedText(0, SETTINGS.marks.note)).toBe("");
  });

  test("above the prompt: opened by the note mark it's given", () => {
    expect(pickedText(2, "N")).toBe("N 2 picked");
    expect(pickedText(0, "N")).toBe("");
  });
});

describe("an option's lead", () => {
  const item: DecideItem = {
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
  const not = { chosen: false, sent: false };

  test("is its mark and its letter, the marks as wide as the kind glyph needing no padding", () => {
    expect(optionLead(item, "A", not, SETTINGS.marks)).toBe("🔘 A. ");
    expect(optionLead(item, "A", { chosen: true, sent: false }, SETTINGS.marks)).toBe("✅ A. ");
    expect(optionLead(item, "A", { chosen: false, sent: true }, SETTINGS.marks)).toBe("✅ A. ");
  });

  test("pads a narrower mark to the item's widest, so a pick moves no text", () => {
    const marks = { chosen: "C", sent: "S" };
    expect(markCells(item, marks)).toBe(2);
    expect(optionLead(item, "A", { chosen: true, sent: false }, marks)).toBe("C  A. ");
    expect(optionLead(item, "A", { chosen: false, sent: true }, marks)).toBe("S  A. ");
    expect(optionLead(item, "A", not, marks)).toBe("🔘 A. ");
  });

  test("pads every option to a wider mark, so the options line up", () => {
    const marks = { chosen: "[x]", sent: "S" };
    expect(markCells(item, marks)).toBe(3);
    expect(optionLead(item, "A", { chosen: true, sent: false }, marks)).toBe("[x] A. ");
    expect(optionLead(item, "B", not, marks)).toBe("🔘  B. ");
    expect(optionLead(item, "A", { chosen: false, sent: true }, marks)).toBe("S   A. ");
  });

  test("counts an option's own glyph among the item's", () => {
    const wide = { ...item, options: [{ letter: "A", name: "Disk", glyph: "[ ]" }, { letter: "B", name: "Memory" }] };
    expect(markCells(wide, SETTINGS.marks)).toBe(3);
    expect(optionLead(wide, "B", not, SETTINGS.marks)).toBe("🔘  B. ");
  });
});

describe("the keys panel", () => {
  const keys = { next: "j", previous: "k", submit: "s", reassess: "r", help: "?" };

  test("lists each key the pane takes and what it does, then the engine's, Escape and its close key closing the pane", () => {
    expect(keyRows(keys, SETTINGS.marks.buttons)).toEqual([
      { key: "j", does: "↓ Next: the next item, or header" },
      { key: "k", does: "↑ Previous: the item before" },
      { key: "s", does: "📤 Submit: send the draft" },
      { key: "r", does: "🔄 Reassess: add or take out the reassess line" },
      { key: "?", does: "? Keys: open or close this panel" },
      { key: "↑ ↓ tab", does: "move between options and fields" },
      { key: "enter", does: "pick the option the ring is on" },
      { key: "esc", does: "close the pane, giving the keyboard back to the prompt" },
      { key: "ctrl+x x", does: "close the pane, as the x in its top right does" },
    ]);
  });

  test("shows a rebound key as rebound", () => {
    expect(keyRows({ ...keys, submit: "x" }, SETTINGS.marks.buttons)[2]).toEqual({ key: "x", does: "📤 Submit: send the draft" });
  });

  test("draws each button's glyph as it's given", () => {
    const glyphs = { next: "v", previous: "^", submit: ">", reassess: "R", help: "H", kanban: "K" };
    expect(keyRows(keys, glyphs).slice(0, 5)).toEqual([
      { key: "j", does: "v Next: the next item, or header" },
      { key: "k", does: "^ Previous: the item before" },
      { key: "s", does: "> Submit: send the draft" },
      { key: "r", does: "R Reassess: add or take out the reassess line" },
      { key: "?", does: "H Keys: open or close this panel" },
    ]);
  });
});
