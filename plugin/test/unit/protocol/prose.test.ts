import { describe, test } from "node:test";
import { expect } from "expect";

import { FRAGMENTS } from "../../../src/protocol/fragments.ts";
import {
  OWN_PLACEHOLDERS,
  assembled,
  codepoint,
  exampleFrees,
  filled,
  fragmentProblems,
  headerWidth,
  piecesOf,
  placeholderValues,
  subscript,
  unusedFragments,
  valuesOf,
} from "../../../src/protocol/prose.ts";
import type { ProseSpec } from "../../../src/protocol/prose.ts";
import { SPEC } from "../../../src/protocol/spec.ts";
import { decideItemsOfText, itemsOfText } from "../../../src/items/outstanding.ts";

const own = {
  plugin: "the-plugin",
  tool: "the_tool",
  "outstanding-tool": "the_outstanding",
  "lint-tool": "the_lint",
};
const values = placeholderValues(SPEC, own);

/** The spec with the Decide list's header and glyph swapped for others. */
const renamed: ProseSpec = {
  ...SPEC,
  lists: { ...SPEC.lists, decide: { ...SPEC.lists.decide, header: "Choose", glyph: "🧩" } },
};

/** The spec with the Review list's rolling up turned to `rollsUp`. */
const reviewRolls = (rollsUp: boolean): ProseSpec => ({
  ...SPEC,
  lists: { ...SPEC.lists, review: { ...SPEC.lists.review, "rolls-up": rollsUp } },
});

/** The spec with a unique prefix of a command's name running it, or not. */
const prefixRuns = (runs: boolean): ProseSpec => ({
  ...SPEC,
  commands: { ...SPEC.commands, "unique-prefix-runs": runs },
});

/** The spec with every option kind taught. */
const allTaught: ProseSpec = {
  ...SPEC,
  options: {
    ...SPEC.options,
    kinds: {
      ...SPEC.options.kinds,
      binary: { ...SPEC.options.kinds.binary, taught: true },
    },
  },
};

/** The text of the one `text` block in a filled fragment. */
const textBlock = (text: string): string =>
  text.split("```text\n")[1]?.split("\n```")[0] ?? "";

describe("piecesOf", () => {
  test("splits a fragment into its text and its placeholders' names, in order", () => {
    expect(piecesOf("A {{lists.decide.header}} item, {{tool}}.")).toEqual({
      pieces: [
        { text: "A " },
        { name: "lists.decide.header" },
        { text: " item, " },
        { name: "tool" },
        { text: "." },
      ],
    });
  });

  test("reads a fragment with no placeholder as one piece of text, and an empty one as none", () => {
    expect(piecesOf("plain {text} and }} alone")).toEqual({
      pieces: [{ text: "plain {text} and }} alone" }],
    });
    expect(piecesOf("")).toEqual({ pieces: [] });
  });

  test("refuses a {{ with no }} after it, however late in the fragment", () => {
    expect(piecesOf("a {{lists.decide.header item")).toEqual({
      problem: "a {{ with no }} after it",
    });
    expect(piecesOf("{{tool}} then {{tool")).toEqual({
      problem: "a {{ with no }} after it",
    });
  });

  test("refuses a name that isn't lower-case words, digits, dots and dashes", () => {
    expect(piecesOf("a {{ tool }} b")).toEqual({
      problem: "the placeholder {{ tool }} isn't a name",
    });
    expect(piecesOf("a {{}} b")).toEqual({
      problem: "the placeholder {{}} isn't a name",
    });
  });

  test("refuses a {{ opened inside another, rather than reading the inner one alone", () => {
    expect(piecesOf("{{a{{b}}")).toEqual({
      problem: "the placeholder {{a{{b}} isn't a name",
    });
  });
});

describe("subscript", () => {
  test("writes a relative index in the tag's subscript digits and minus", () => {
    expect(subscript(-17, SPEC.tag)).toBe("₋₁₇");
    expect(subscript(0, SPEC.tag)).toBe("₀");
    expect(subscript(3, SPEC.tag)).toBe("₃");
  });
});

describe("codepoint", () => {
  test("names a character by its code point", () => {
    expect(codepoint("⠀")).toBe("U+2800");
    expect(codepoint("━")).toBe("U+2501");
    expect(codepoint("")).toBe("");
  });
});

describe("headerWidth", () => {
  test("counts a header's cells as drawn: the glyph, a space, the bold name and its colon", () => {
    expect(headerWidth("⏳", "Waiting")).toBe(11);
    expect(headerWidth("🔑", "Authorizations")).toBe(18);
    expect(headerWidth("📌", "Outstanding from previous turns")).toBe(35);
  });

  test("counts the glyph by the cells it takes, not as 2 whatever it is", () => {
    expect(headerWidth("#", "Waiting")).toBe(10);
    expect(headerWidth("☑️", "Waiting")).toBe(11);
  });
});

describe("placeholderValues", () => {
  test("holds every string and number in the spec by its path, an array's by index", () => {
    expect(values["lists.decide.header"]).toBe("Decide");
    expect(values["lists.waiting.glyph"]).toBe("⏳");
    expect(values["reference.turn-id.length"]).toBe("8");
    expect(values["reference.turn-after.0"]).toBe("of");
    expect(values["characters.separator"]).toBe("⠀");
    expect(values["options.kinds.radio.picks"]).toBe("one");
  });

  test("leaves out the spec's booleans, which prose says in words", () => {
    expect(values["lists.decide.rolls-up"]).toBeUndefined();
    expect(values["options.kinds.radio.taught"]).toBeUndefined();
  });

  test("writes each list's header, its underline and its width as a final response draws them", () => {
    expect(values["header.decide"]).toBe("🧠 **Decide:**");
    expect(values["list.decide"]).toBe("🧠 Decide");
    expect(values["underline.waiting"]).toBe("11");
    expect(values["rule.waiting"]).toBe("▔".repeat(11));
    expect(values["header.roll-up"]).toBe("📌 **Outstanding from previous turns:**");
    expect(values["underline.roll-up"]).toBe("35");
    expect(values["rule.roll-up"]).toBe("━".repeat(35));
  });

  test("names the lists, and the ones that roll up and don't, in the spec's order", () => {
    expect(values["count.lists"]).toBe("9");
    expect(values["names.lists"]).toBe(
      "Done, Pending, Logged, Waiting, Answers, Authorizations, Review, Todo and Decide",
    );
    expect(values["names.rolled-up"]).toBe("Pending, Waiting, Authorizations, Review, Todo and Decide");
    expect(values["names.not-rolled-up"]).toBe("Done, Logged and Answers");
    expect(values["glyphs.rolled-up"]).toBe(
      "🚧 Pending, ⏳ Waiting, 🔑 Authorizations, 🔍 Review, 👉 Todo and 🧠 Decide",
    );
  });

  test("put a list among those that roll up by its own rolls-up, and among the others when it's false", () => {
    const rolls = placeholderValues(reviewRolls(true), own);
    const keeps = placeholderValues(reviewRolls(false), own);

    expect(rolls["names.rolled-up"]).toContain("Review");
    expect(rolls["names.not-rolled-up"]).not.toContain("Review");
    expect(keeps["names.rolled-up"]).not.toContain("Review");
    expect(keeps["names.not-rolled-up"]).toBe("Done, Logged, Answers and Review");
    expect(keeps["example.count-line"]).not.toContain("🔍");
  });

  test("draws the examples from the spec's glyphs, digits and lengths", () => {
    expect(values["example.turn"]).toBe("0f311c94");
    expect(values["example.tag"]).toBe("🔖 0f311c94₋₃");
    expect(values["example.index"]).toBe("₋₁₇");
    expect(values["example.count-line"]).toBe("📌 Outstanding: 🚧 1 · ⏳ 2 · 🔑 3 · 🔍 4 · 👉 5 · 🧠 6");
    expect(values["roll-up.count-mark"]).toBe("·");
  });

  test("names each command with its synonyms, bare and as a label, and which trail", () => {
    expect(values["command.reassess"]).toBe(
      "`reassess` (or `recheck`, `regenerate`, `recalculate`)",
    );
    expect(values["command.open.name"]).toBe("`open`");
    expect(values["command.reassess.word"]).toBe("reassess");
    expect(values["command.reassess.label"]).toBe("Reassess");
    expect(values["names.trailing"]).toBe("`reassess`");
    expect(values["names.not-trailing"]).toBe("`open`");
  });

  test("give a command's prefixes only while a unique prefix runs it", () => {
    const runs = placeholderValues(prefixRuns(true), own);
    const not = placeholderValues(prefixRuns(false), own);

    expect(runs["command.reassess.prefix"]).toBe("`rea`");
    expect(runs["command.reassess.shared-prefix"]).toBe("`re`");
    expect(runs["command.open.prefix"]).toBe("`o`");
    expect(runs["command.open.shared-prefix"]).toBeUndefined();
    expect(not["command.reassess.prefix"]).toBeUndefined();
    expect(not["command.reassess.shared-prefix"]).toBeUndefined();
  });

  test("name only the option kinds the instructions teach, their glyphs and their letters", () => {
    expect(values["kinds.names"]).toBe("`radio` or `checkbox`");
    expect(values["glyphs.options"]).toBe("🔘 or 🔲");
    expect(values["count.option-glyphs"]).toBe("2");
    expect(values["letters.example"]).toBe("`A`, `B`, `C`");
    expect(values["letters.pair"]).toBe("`A` and `B`");
    expect(values["letters.radio"]).toBe("`A`, `B`, `C`");
    expect(values["kind.radio"]).toBe("🔘 radio");
    expect(values["kind.checkbox.name"]).toBe("checkbox");
    expect(values["letters.binary"]).toBeUndefined();
    expect(values["kind.binary"]).toBeUndefined();
  });

  test("name a kind not taught's glyphs and letters, for the rules that a reply no longer writes them", () => {
    expect(values["untaught.glyphs"]).toBe("👍 or 👎");
    expect(values["untaught.letters"]).toBe("`Y` or `N`");
    expect(values["untaught.options"]).toBe("👍 `Y` and 👎 `N`");
  });

  test("teach a kind the spec marks taught, and name no kind not taught once every kind is", () => {
    const every = placeholderValues(allTaught, own);

    expect(every["kinds.names"]).toBe("`radio`, `checkbox` or `binary`");
    expect(every["glyphs.options"]).toBe("🔘, 🔲, or 👍 and 👎");
    expect(every["count.option-glyphs"]).toBe("4");
    expect(every["letters.binary"]).toBe("`Y` and `N`");
    expect(every["untaught.glyphs"]).toBeUndefined();
  });

  test("names each rule character by its code point", () => {
    expect(values["codepoint.separator"]).toBe("U+2800");
    expect(values["codepoint.header-underline"]).toBe("U+2594");
  });

  test("holds the plugin's own values", () => {
    expect(Object.keys(own).toSorted()).toEqual([...OWN_PLACEHOLDERS].toSorted());
    expect(values["tool"]).toBe("the_tool");
    expect(values["plugin"]).toBe("the-plugin");
  });

  test("follow the spec they're given", () => {
    const other = placeholderValues(renamed, own);

    expect(other["header.decide"]).toBe("🧩 **Choose:**");
    expect(other["names.lists"]).toContain("Todo and Choose");
  });

  test("refuse a placeholder two sources name", () => {
    const clashing = { ...SPEC, plugin: "from the spec" };

    expect(() => placeholderValues(clashing, own)).toThrow(
      "more than one value for {{plugin}}",
    );
  });
});

describe("valuesOf", () => {
  test("gives each entry's value by its name", () => {
    expect(valuesOf([["a", "1"], ["b", "2"]])).toEqual({ a: "1", b: "2" });
  });

  test("refuses each name more than one entry gives", () => {
    expect(() => valuesOf([["a", "1"], ["b", "2"], ["a", "3"], ["b", "2"]])).toThrow(
      "more than one value for {{a}}, {{b}}",
    );
  });
});

describe("exampleFrees", () => {
  test("names a Decide item and a Review item of the example turn, by the spec's label and separator", () => {
    expect(exampleFrees(SPEC)).toBe("Frees: 0f311c94.Decide.2, 0f311c94.Review.1");
    expect(values["example.frees"]).toBe(exampleFrees(SPEC));
  });

  test("follows the spec's lists and its line's label and separator", () => {
    expect(exampleFrees({ ...renamed, frees: { label: "Unblocks", separator: ";" } })).toBe(
      "Unblocks: 0f311c94.Choose.2; 0f311c94.Review.1",
    );
  });
});

describe("filled", () => {
  test("puts each placeholder's value in its place", () => {
    expect(filled("{{header.decide}} and {{tool}}", values)).toBe("🧠 **Decide:** and the_tool");
  });

  test("leaves a placeholder with no value as it was written", () => {
    expect(filled("a {{nothing.here}} b", values)).toBe("a {{nothing.here}} b");
  });
});

describe("the fragments' examples", () => {
  test("read back as the Decide items they draw, by the plugin's own reader", () => {
    expect(decideItemsOfText(textBlock(filled(FRAGMENTS["decide-items"], values)))).toEqual([
      { number: 1, summary: "Backlog cleanups to start, of 260 entries in the backlog" },
      { number: 2, summary: "Ship the 2.4 release tonight?" },
    ]);
  });

  test("read back as the item and the items it frees they draw, by the plugin's own reader", () => {
    expect(itemsOfText(textBlock(filled(FRAGMENTS["frees"], values)))).toEqual([
      expect.objectContaining({
        list: "todo",
        number: 1,
        frees: ["0f311c94.Decide.2", "0f311c94.Review.1"],
      }),
    ]);
  });

  test("read back as the roll-up items they draw, by the plugin's own reader", () => {
    expect(itemsOfText(textBlock(filled(FRAGMENTS["roll-up"], values)))).toEqual([
      expect.objectContaining({ list: "waiting", isPinned: true }),
      expect.objectContaining({ list: "decide", isPinned: true }),
    ]);
  });
});

describe("fragmentProblems", () => {
  test("finds nothing in fragments whose every placeholder has a value", () => {
    expect(fragmentProblems({ a: "{{header.todo}}", b: "plain" }, values)).toEqual([]);
  });

  test("names each placeholder the spec has no value for, by its fragment", () => {
    expect(
      fragmentProblems({ a: "{{header.nothing}} and {{lists.decide.colour}}" }, values),
    ).toEqual([
      "a: no value in the spec for {{header.nothing}}",
      "a: no value in the spec for {{lists.decide.colour}}",
    ]);
  });

  test("names a fragment that doesn't read", () => {
    expect(fragmentProblems({ b: "a {{tool" }, values)).toEqual([
      "b: a {{ with no }} after it",
    ]);
  });

  test("finds a placeholder a spec change takes the value of", () => {
    expect(
      fragmentProblems({ a: "{{header.decide}}" }, placeholderValues(
        { ...SPEC, lists: { done: SPEC.lists.done } },
        own,
      )),
    ).toEqual(["a: no value in the spec for {{header.decide}}"]);
    expect(
      fragmentProblems({ a: "{{command.reassess.prefix}}" }, placeholderValues(prefixRuns(false), own)),
    ).toEqual(["a: no value in the spec for {{command.reassess.prefix}}"]);
  });
});

describe("unusedFragments", () => {
  test("names each fragment no output uses", () => {
    expect(unusedFragments(["a", "b", "c"], [["a"], ["c", "a"]])).toEqual(["b"]);
    expect(unusedFragments(["a"], [["a"]])).toEqual([]);
  });
});

describe("assembled", () => {
  test("fills the fragments in the order given, parted by a blank line", () => {
    expect(
      assembled({ one: "{{list.todo}}\n", two: "and {{tool}}" }, ["two", "one"], values),
    ).toBe("and the_tool\n\n👉 Todo");
  });
});
