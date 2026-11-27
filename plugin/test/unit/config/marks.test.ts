// The pane's marks, settings in defaults/config.yaml's `marks`: the shipped
// ones are the glyphs the pane drew before they were settings, a user's
// file changes any of them alone, and a mark that isn't a string, is empty
// or would break its line refuses the file as any wrong type does.

import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { expect } from "expect";

import { DEFAULTS_FILE, loaded, parseYaml } from "../../../src/config/config.ts";

const defaults = {
  path: "defaults/config.yaml",
  text: readFileSync(new URL(`../../../${DEFAULTS_FILE}`, import.meta.url), "utf8"),
};
const U = "~/.config/x/config.yaml";
const user = (text: string) => ({ path: U, text });

// The marks the pane drew before they were settings, but `sent`, which
// ☑️ was until common terminals were found drawing it grey.
const TODAY = {
  sent: "✅",
  chosen: "✅",
  note: "✏️",
  "settled-bar": "▌",
  collapsed: "▸",
  expanded: "▾",
  buttons: {
    dismiss: "✖",
    next: "↓",
    previous: "↑",
    submit: "📤",
    reassess: "🔄",
    help: "?",
    kanban: "🖥️",
  },
};

describe("the shipped marks", () => {
  test("are the glyphs the pane drew before they were settings", () => {
    const got = loaded(defaults, undefined);
    expect(got.problems).toEqual([]);
    expect(got.settings?.marks).toEqual(TODAY);
  });

  test("mark an answered option as a picked one, the sent mark being the chosen mark", () => {
    const marks = loaded(defaults, undefined).settings?.marks;
    expect(marks?.sent).toBe(marks?.chosen);
  });

  test("give the sent mark back to a user who sets it", () => {
    expect(loaded(defaults, user("marks:\n  sent: ☑️\n")).settings?.marks.sent).toBe("☑️");
  });
});

describe("a user's marks over the shipped ones", () => {
  test("change only the marks they name", () => {
    const got = loaded(defaults, user('marks:\n  chosen: "✔"\n'));
    expect(got.problems).toEqual([]);
    expect(got.settings?.marks).toEqual({ ...TODAY, chosen: "✔" });
    expect(got.effective).toContain(`marks.chosen = "✔"  # user: ${U}`);
  });

  test("change one button's glyph, keeping the others", () => {
    const got = loaded(defaults, user('marks:\n  buttons:\n    submit: ">"\n'));
    expect(got.problems).toEqual([]);
    expect(got.settings?.marks.buttons).toEqual({ ...TODAY.buttons, submit: ">" });
    expect(got.effective).toContain(`marks.buttons.submit = ">"  # user: ${U}`);
  });

  test("with a null buttons section, as one with every key commented out reads, keep every button's", () => {
    const got = loaded(defaults, user("marks:\n  buttons:\n"));
    expect(got.problems).toEqual([]);
    expect(got.settings?.marks).toEqual(TODAY);
  });
});

describe("a mark that can't be used", () => {
  test("refuses the user's file when it isn't a string, saying to quote a number", () => {
    expect(loaded(defaults, user("marks:\n  chosen: 1\n")).problems).toEqual([
      `${U}: marks.chosen is number, not a string; quote it`,
    ]);
    expect(loaded(defaults, user("marks:\n  collapsed: [a]\n")).problems).toEqual([
      `${U}: marks.collapsed is a list, not a string`,
    ]);
    expect(loaded(defaults, user("marks:\n  buttons:\n    help: true\n")).problems).toEqual([
      `${U}: marks.buttons.help is boolean, not a string; quote it`,
    ]);
  });

  test("refuses the user's file when the buttons aren't a section, or name no button", () => {
    expect(loaded(defaults, user("marks:\n  buttons: x\n")).problems).toEqual([
      `${U}: marks.buttons is string, not a section`,
    ]);
    expect(loaded(defaults, user("marks:\n  buttons:\n    close: x\n")).problems).toEqual([
      `${U}: marks.buttons.close is no setting; the keys here are dismiss, next, previous, submit, reassess, help, kanban`,
    ]);
  });

  test("refuses an empty mark, which the pane would draw as nothing, saying to quote a glyph", () => {
    expect(loaded(defaults, user('marks:\n  chosen: ""\n')).problems).toEqual([
      `${U}: marks.chosen is "", not a mark; write a glyph, quoted where YAML would read it otherwise, such as ">"`,
    ]);
  });

  test("refuses a bare `>`, which YAML reads as an empty folded scalar", () => {
    const text = "marks:\n  buttons:\n    submit: >\n";
    expect(parseYaml(text)).toEqual({ value: { marks: { buttons: { submit: "" } } } });
    expect(loaded(defaults, user(text)).problems).toEqual([
      `${U}: marks.buttons.submit is "", not a mark; write a glyph, quoted where YAML would read it otherwise, such as ">"`,
    ]);
    expect(loaded(defaults, user('marks:\n  buttons:\n    submit: ">"\n')).problems).toEqual([]);
  });

  test("refuses a mark holding a control character, or a line or paragraph separator", () => {
    const undrawable = [0x09, 0x0a, 0x07, 0x7f, 0x85, 0x2028, 0x2029].map(
      (point) => `a${String.fromCodePoint(point)}`,
    );

    for (const mark of undrawable) {
      expect(loaded(defaults, user(JSON.stringify({ marks: { note: mark } }))).problems).toEqual([
        `${U}: marks.note is ${JSON.stringify(mark)}, which holds a control character or a line break; a mark is drawn on one line`,
      ]);
    }
  });

  test("takes any other string: an emoji with its joiners, or several characters", () => {
    const coder = String.fromCodePoint(0x1f469, 0x200d, 0x1f4bb);
    const got = loaded(defaults, user(JSON.stringify({ marks: { note: coder, chosen: "[x]" } })));
    expect(got.problems).toEqual([]);
    expect(got.settings?.marks).toMatchObject({ note: coder, chosen: "[x]" });
  });

  test("leaves the shipped marks in effect when it refuses the file", () => {
    expect(loaded(defaults, user("marks:\n  chosen: 1\n")).settings?.marks).toEqual(TODAY);
  });
});
