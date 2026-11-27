// Replies for the tests of a reply's readers: seeded random replies built
// from the protocol's pieces, list headers and their aliases, items numbered
// and bulleted with lines under them, options, `Frees:` lines, code blocks,
// separators, underlines, topic headers, 📌 roll-ups and count lines; and
// the Decide items a reply's Decide list may print.
//
// A `strict` reply keeps to what every reader read alike before
// `parseReply`, so the old readers and the new give the same for it; a
// loose one also writes what only the old `itemsOfText` read as the new one
// does: items 1 to 3 spaces in, numbered `1)`, numbered lines under an item,
// a number alone on its line with the bold summary beneath it, an option
// after a blank line, and code blocks holding any line. What a strict reply
// leaves out, and why, is the list of the readers' differences in
// test/unit/transcript/reply-differential.test.ts.

import fc from "fast-check";

import { DECISIONS, SECTION_NAMES } from "../../src/protocol/rules.ts";
import { SPEC } from "../../src/protocol/spec.ts";
import type { DecideItem } from "../../types/index.d.ts";

const CHARS = SPEC.characters;
const ROLL_UP = SPEC["roll-up"];

/** Whether a reply keeps to what every reader read alike. */
export type Mode = "strict" | "loose";

/** The summaries the replies' items and the Decide items share, so a reply's summary line names an item. */
export const SUMMARIES = [
  "Which cache to keep",
  "Ship `tonight`?",
  "Rework the loader",
  "Run the benchmark",
] as const;

/** The options' letters and names the replies and the Decide items share. */
export const OPTIONS = [
  { letter: "A", name: "Disk" },
  { letter: "B", name: "Memory" },
  { letter: "C", name: "Both" },
] as const;

const OPTION_GLYPHS = Object.values(SPEC.options.kinds).flatMap((kind) => [
  kind.glyph,
  ...Object.values(kind.letters),
]);

const BR = fc.constantFrom("", "  ");
const summaryArb = fc.constantFrom(...SUMMARIES);
const underlineArb = (char: string) =>
  fc.integer({ min: 3, max: 12 }).map((n) => char.repeat(n));

/** A list's header: its glyph or another, then one of its names in bold with a colon. */
const headerArb = (names: readonly string[]) =>
  fc
    .tuple(
      fc.constantFrom(...Object.values(SPEC.lists).map((list) => list.glyph), "🙃"),
      fc.constantFrom(...names),
      BR,
    )
    .map(([glyph, name, br]) => `${glyph} **${name}:**${br}`);

/** An item's own text: its bold summary alone, with text beside it, with a 🔖 tag, or plain. */
const headTextArb = fc.oneof(
  fc.tuple(summaryArb, BR).map(([summary, br]) => `**${summary}**${br}`),
  summaryArb.map((summary) => `**${summary}**: with its text beside it`),
  summaryArb.map((summary) => `**${summary}** 🔖 b2c3d4e5₋₁`),
  fc.constant("Plain words, no summary"),
);

/** An option's line, 3 spaces in. */
const optionArb = fc
  .tuple(fc.constantFrom(...OPTION_GLYPHS), fc.constantFrom(...OPTIONS, { letter: "Y", name: "Ship" }))
  .map(([glyph, { letter, name }]) => `   ${glyph} ${letter}. **${name}**: why.`);

/**
 * A code block under an item: its fences `pad` in, as far as the item's
 * text, closed, holding inert lines, blank lines among them where `blanks`,
 * and any line where loose and `rich`, in an item of a list that rolls up,
 * the only code the old `itemsOfText` read as code.
 */
const codeArb = (mode: Mode, blanks: boolean, rich = false, pad = "   ") =>
  fc
    .array(
      fc.constantFrom(
        "   some code",
        "   more code",
        ...(blanks || mode === "loose" ? [""] : []),
        ...(mode === "loose" && rich
          ? [
              "🧠 **Decide:**",
              CHARS["topic-underline"].repeat(5),
              "1. **Which cache to keep**",
              `${ROLL_UP.glyph} **${ROLL_UP.header}:**`,
            ]
          : []),
      ),
      { maxLength: 4 },
    )
    .chain((inner) =>
      fc
        .constantFrom("```", "~~~")
        .map((fence) => [`${pad}${fence}text`, ...inner, `${pad}${fence}`]),
    );

/** The lines under an item: a sentence, options where `optioned`, steps, prose at the line's start, an underline, a code block `pad` in, and a `Frees:` line. */
const bodyArb = (mode: Mode, optioned: boolean, blanks: boolean, rich: boolean, pad: string) =>
  fc
    .array(
      fc.oneof(
        fc.constant(["   It still reads twice."]),
        ...(optioned ? [optionArb.map((line) => [line])] : []),
        fc.constant(["      ➕ Cheap."]),
        fc.constant(["   - a step of its own"]),
        fc.constant(["Prose at the line's start."]),
        underlineArb(CHARS["header-underline"]).map((line) => [`   ${line}`]),
        codeArb(mode, blanks, rich, pad),
        fc.constant(["   Frees: 9efb08a1.Todo.1, 9efb08a1.Decide.2"]),
        ...(mode === "loose" ? [fc.constant(["   1. **Which cache to keep**"])] : []),
      ),
      { maxLength: 4 },
    )
    .map((groups) => groups.flat());

/** What a list's items may write: blank lines in their code, code holding any line where loose, as in a list that rolls up. */
type Room = Readonly<{ blanks: boolean; rich: boolean }>;

/** A number alone on its line, perhaps a blank line, its bold summary beneath, and options, as an item above it holds them: no code. */
const bareArb = (n: number, delimiter: string, indent: string) =>
  fc
    .tuple(summaryArb, fc.constantFrom([], [""]), fc.array(optionArb, { maxLength: 2 }))
    .map(([summary, gap, options]) => [`${indent}${n}${delimiter}`, ...gap, `**${summary}**`, ...options]);

/**
 * One item and the lines under it, numbered `n` where numbered, 1 to 3
 * spaces in where loose and `indented`; where loose and `indented`, its
 * number may stand alone on its line, its summary beneath.
 */
const itemArb = (mode: Mode, n: number, { blanks, rich }: Room, indented: boolean) =>
  fc
    .tuple(
      fc.constantFrom(
        "number",
        "number",
        "-",
        "*",
        ...(mode === "loose" && indented ? ["bare"] : []),
      ),
      fc.constantFrom(...(mode === "loose" ? [".", ")"] : ["."])),
      fc.constantFrom(...(mode === "loose" && indented ? ["", " ", "  ", "   "] : [""])),
      headTextArb,
    )
    .chain(([marker, delimiter, indent, text]) => {
      const lead = `${indent}${marker === "number" ? `${n}${delimiter}` : marker} `;
      const pad = " ".repeat(Math.max(3, lead.length));

      return marker === "bare"
        ? bareArb(n, delimiter, indent)
        : bodyArb(mode, true, blanks, rich, pad).map((body) => [`${lead}${text}`, ...body]);
    });

/** What parts two items, where it does: a separator, or where loose, a blank line and an option, the item above's, as the kanban skill reads it. */
const partingArb = (mode: Mode): fc.Arbitrary<readonly string[]> =>
  fc.constantFrom(["   ⠀"], ["⠀"], ...(mode === "loose" ? [["", "   🔘 C. **Both**: why."]] : []));

/**
 * A list's items, something parting some of them; an item is 1 to 3 spaces
 * in only where it's neither the first nor after a parting, so an item is
 * always above it.
 */
const itemsArb = (mode: Mode, room: Room) =>
  fc
    .array(fc.tuple(fc.boolean(), partingArb(mode)), {
      minLength: 1,
      maxLength: 4,
    })
    .chain((gaps) =>
      fc
        .tuple(
          ...gaps.map(([parted], n) =>
            itemArb(mode, n + 1, room, n > 0 && !parted),
          ),
        )
        .map((items) =>
          items.flatMap((lines, n) => {
            const [parted, parting] = gaps[n] ?? [false, []];

            return n > 0 && parted ? [...parting, ...lines] : lines;
          }),
        ),
    );

/** A list: its header, perhaps its underline, and its items. */
const sectionArb = (mode: Mode) =>
  fc.constantFrom(...SECTION_NAMES).chain((name) =>
    fc
      .tuple(
        headerArb([name]),
        fc.option(underlineArb(CHARS["header-underline"]), { nil: undefined }),
        itemsArb(mode, {
          blanks: !DECISIONS.includes(name),
          rich: Object.values(SPEC.lists).some(
            (list) =>
              list["rolls-up"] &&
              ([list.header, ...list.aliases] as readonly string[]).includes(name),
          ),
        }),
      )
      .map(([header, underline, items]) => [
        header,
        ...(underline === undefined ? [] : [underline]),
        ...items,
      ]),
  );

/** The 📌 roll-up: its header or an older one, perhaps its underline, and its lists' bullets, each tagged. */
const rollUpArb = fc
  .tuple(
    fc.constantFrom(ROLL_UP.header, ...ROLL_UP.aliases),
    BR,
    fc.option(underlineArb(CHARS["roll-up-underline"]), { nil: undefined }),
    fc.array(
      fc.tuple(
        headerArb(SECTION_NAMES),
        fc.array(summaryArb.map((summary) => `- **${summary}** 🔖 b2c3d4e5₋₁`), {
          minLength: 1,
          maxLength: 2,
        }),
      ),
      { minLength: 1, maxLength: 3 },
    ),
  )
  .map(([name, br, underline, groups]) => [
    `${ROLL_UP.glyph} **${name}:**${br}`,
    ...(underline === undefined ? [] : [underline]),
    ...groups.flatMap(([header, bullets]) => [header, ...bullets]),
  ]);

/** A topic header, a blank line above it: its title and its rule. */
const topicArb = fc
  .tuple(fc.constantFrom("The loader", "Releases"), underlineArb(CHARS["topic-underline"]))
  .map(([title, rule]) => ["", `**${title}**  `, rule]);

/** A code block outside any list, a blank line above it, holding inert lines. */
const looseCodeArb = fc
  .array(fc.constantFrom("some code", "", "more code"), { maxLength: 3 })
  .map((inner) => ["", "```text", ...inner, "```"]);

/** The count line. */
const COUNT = `${ROLL_UP.glyph} ${ROLL_UP["count-label"]}: 🚧 1${ROLL_UP["count-separator"]}🧠 2`;

/** One part of a reply. */
const partArb = (mode: Mode) =>
  fc.oneof(
    { weight: 4, arbitrary: sectionArb(mode) },
    { weight: 1, arbitrary: rollUpArb },
    { weight: 1, arbitrary: topicArb },
    { weight: 1, arbitrary: looseCodeArb },
    { weight: 1, arbitrary: fc.constant(["Some work.", "It went well."]) },
    { weight: 1, arbitrary: fc.constant([COUNT]) },
    {
      weight: 1,
      arbitrary: fc.constantFrom(...ROLL_UP.aliases.flatMap((older) => [[older], [`${older}:`]])),
    },
  );

/** A reply's lines from its parts, a blank line between two, or none. */
const joined = (
  parts: readonly (readonly [boolean, readonly string[]])[],
): readonly string[] =>
  parts.flatMap(([gap, lines], n) => (n > 0 && gap ? ["", ...lines] : lines));

/** A random reply's text. */
export const replyArb = (mode: Mode): fc.Arbitrary<string> =>
  fc
    .array(fc.tuple(fc.boolean(), partArb(mode)), { minLength: 1, maxLength: 6 })
    .chain((parts) =>
      fc.constantFrom("", "\n").map((end) => `${joined(parts).join("\n")}${end}`),
    );

/** Decide items as a `kanban_options` call raises them, each a summary and its options. */
export const decideItemsArb: fc.Arbitrary<readonly DecideItem[]> = fc
  .uniqueArray(summaryArb, { minLength: 1, maxLength: 3 })
  .chain((summaries) =>
    fc.tuple(
      ...summaries.map((summary, n) =>
        fc
          .subarray([...OPTIONS], { minLength: 1 })
          .map((options): DecideItem => ({
            turn: "9efb08a1",
            list: "Decide",
            number: n + 1,
            summary,
            kind: "radio",
            ref: `9efb08a1.Decide.${n + 1}`,
            options,
          })),
      ),
    ),
  );

/** A Decide list printing `items` as the instructions draw them, with lines of their own besides. */
export const decideListArb = (
  items: readonly DecideItem[],
): fc.Arbitrary<readonly string[]> =>
  fc
    .tuple(
      headerArb(DECISIONS),
      fc.option(underlineArb(CHARS["header-underline"]), { nil: undefined }),
      fc.tuple(
        ...items.map((item) =>
          fc
            .tuple(
              BR,
              fc.subarray(["   It still reads twice.", "   Frees: 9efb08a1.Todo.1"]),
              fc.constantFrom(...OPTION_GLYPHS),
              fc.option(codeArb("strict", false), { nil: undefined }),
              fc.subarray(["Prose at the line's start."]),
            )
            .map(([br, extra, glyph, code, prose]) => [
              `${item.number}. **${item.summary}**${br}`,
              ...extra,
              ...item.options.map(
                (option) => `   ${glyph} ${option.letter}. **${option.name}**: why.`,
              ),
              ...(code ?? []),
              ...prose,
            ]),
        ),
      ),
    )
    .map(([header, underline, printed]) => [
      header,
      ...(underline === undefined ? [] : [underline]),
      ...printed.flatMap((lines, n) => (n > 0 ? ["   ⠀", ...lines] : lines)),
    ]);

/** A random reply with `items`' Decide list among its parts, and the items. */
export const replyWithItemsArb: fc.Arbitrary<
  Readonly<{ text: string; items: readonly DecideItem[] }>
> = decideItemsArb.chain((items) =>
  fc
    .tuple(
      fc.array(fc.tuple(fc.boolean(), partArb("strict")), { maxLength: 2 }),
      decideListArb(items),
      fc.array(fc.tuple(fc.boolean(), partArb("strict")), { maxLength: 2 }),
    )
    .map(([before, list, after]) => ({
      text: joined([...before, [true, list], ...after]).join("\n"),
      items,
    })),
);
