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
  noteRows,
  notPutBackText,
  notSentText,
  notesKey,
  putBackText,
  notesMode,
  pickedText,
  sentLetters,
  settledText,
  submitStep,
} from "../../../src/pane/view.ts";
import type { DecideItem, Raised } from "../../../types/index.d.ts";

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
const raised: Raised = { ...emptyRaised, items: [radio, binary] };

describe("the text with no open items", () => {
  test("says why when the reason is known", () => {
    expect(noItemsText("")).toBe("No open Decide items.");
    expect(noItemsText("no script")).toBe("No open Decide items: no script.");
  });
});

describe("/answers's reply", () => {
  test("counts the open items the pane opened over, the settled left out", () => {
    expect(answersText(raised)).toBe("Decide pane opened: 2 open Decide items.");
    expect(answersText({ ...raised, settledRefs: ["9efb08a1.Decide.1"] })).toBe(
      "Decide pane opened: 1 open Decide items.",
    );
  });

  test("says there are none, and why", () => {
    expect(answersText({ ...emptyRaised, problem: "it broke" })).toBe(
      "No open Decide items: it broke.",
    );
    expect(
      answersText({ ...raised, settledRefs: ["9efb08a1.Decide.1", "9efb08a1.Decide.2"] }),
    ).toBe("No open Decide items.");
  });
});

describe("/answers-config's reply", () => {
  test("lists the settings in effect, then what wasn't used, then the warnings", () => {
    expect(
      configText(
        ["keys.dismiss = q", "colors.title = claude"],
        ["bad.yaml: parse error"],
        ["old.jsonc: convert it"],
      ),
    ).toBe(
      "keys.dismiss = q\ncolors.title = claude\nNot used: bad.yaml: parse error\nWarning: old.jsonc: convert it",
    );
  });

  test("is empty with nothing to list", () => {
    expect(configText([], [], [])).toBe("");
  });
});

describe("the tool's result", () => {
  test("names each item drawn by its reference, filling a missing one", () => {
    expect(drewText([radio, binary])).toBe(
      "Drew buttons for 2 Decide items under the final response and in the Decide pane: 9efb08a1.Decide.1, 9efb08a1.Decide.2.",
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

  test("says so when a reassess, an item asked again, or nothing the transcript says made it Done", () => {
    expect(settledText({ ref: "r", how: "reassessed" })).toBe("Done: reassessed");
    expect(settledText({ ref: "r", how: "restated" })).toBe("Done: asked again");
    expect(settledText(undefined)).toBe("Done");
    expect(sentLetters({ ref: "r", how: "reassessed" })).toEqual([]);
    expect(sentLetters(undefined)).toEqual([]);
  });

  test("is the answer Submit sent, until the turn's end reads it", () => {
    const sent = { ref: "r", how: "sent", letters: ["B"], note: "" } as const;
    expect(settledText(sent)).toBe("Sent: B");
    expect(settledText({ ...sent, note: "only the loader" })).toBe("Sent: B · only the loader");
    expect(sentLetters(sent)).toEqual(["B"]);
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

  test("lights in the hover colour under the pointer while the item is open", () => {
    expect(gutterStyle(false, "9efb08a1.Decide.1.A", colors)).toEqual({
      hover: { scope: "9efb08a1.Decide.1.A", backgroundColor: "suggestion" },
    });
  });

  test("stays lit in the settled colour, and never hovers, once the item is settled", () => {
    expect(gutterStyle(true, "9efb08a1.Decide.1.A", colors)).toEqual({
      backgroundColor: "ide",
    });
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
    expect(pickedText(2)).toBe("✏️ 2 picked");
    expect(pickedText(0)).toBe("");
  });
});

describe("the keys panel", () => {
  const keys = { dismiss: "q", next: "j", previous: "k", submit: "s", reassess: "r", help: "?" };

  test("lists each key the pane takes and what it does, then the engine's", () => {
    expect(keyRows(keys)).toEqual([
      { key: "j", does: "↓ Next: the next item, or Done header" },
      { key: "k", does: "↑ Previous: the item before" },
      { key: "s", does: "📤 Submit: send the draft" },
      { key: "r", does: "🔄 Reassess: add or take out the reassess line" },
      { key: "?", does: "? Keys: open or close this panel" },
      { key: "q", does: "✖ Close: close the pane" },
      { key: "↑ ↓ tab", does: "move between options and fields" },
      { key: "enter", does: "pick the option the ring is on" },
      { key: "esc", does: "give the keyboard back to the prompt" },
    ]);
  });

  test("shows a rebound key as rebound", () => {
    expect(keyRows({ ...keys, submit: "x" })[2]).toEqual({ key: "x", does: "📤 Submit: send the draft" });
  });
});
