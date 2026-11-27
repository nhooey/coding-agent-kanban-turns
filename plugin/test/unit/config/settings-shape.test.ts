// The settings' shape, derived from the shipped defaults file: each
// setting the type of its default, unless KINDS names its section's; and
// the settings in effect over random user files, under the shipped
// defaults and altered ones.

import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { expect } from "expect";
import fc from "fast-check";
import { stringify } from "yaml";

import {
  DEFAULTS_FILE,
  clashesIn,
  leaves,
  loaded,
  nullSectionsEmptied,
  parseYaml,
  shapeOf,
} from "../../../src/config/config.ts";
import type { Shape } from "../../../src/config/config.ts";
import type { Json, Loaded } from "../../../types/index.d.ts";
import { SETTINGS_SHAPE } from "../../fixtures/settings-shape.ts";

const isSection = (value: Json | undefined): value is { readonly [key: string]: Json } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const SHIPPED = readFileSync(new URL(`../../../${DEFAULTS_FILE}`, import.meta.url), "utf8");
const parsed = parseYaml(SHIPPED);
const shipped: { readonly [key: string]: Json } =
  "value" in parsed && isSection(parsed.value) ? parsed.value : {};
const derived = shapeOf(shipped);
const shape: Shape = "shape" in derived ? derived.shape : {};

const NO_TYPE =
  "so its default gives it no type; write a string, a number, or true or false, or name its section's type in KINDS in src/config/config.ts";
const NO_KEYS = "keys is missing, a section KINDS names";
const NO_MARKS = "marks is missing, a section KINDS names";

// The least each section KINDS names must hold in a defaults file, as YAML
// and as a value, so a test's own defaults give a shape.
const KINDS_YAML = "keys:\n  help: q\nmarks:\n  m: x\n";
const MARKS = { m: "x" };

const D = "defaults/config.yaml";
const U = "~/.config/x/config.yaml";

describe("the shape the shipped defaults file gives", () => {
  test("is the fixture's, in the same order", () => {
    expect(derived).toEqual({ shape: SETTINGS_SHAPE });
    expect(JSON.stringify(shape)).toBe(JSON.stringify(SETTINGS_SHAPE));
  });
});

describe("the shape a defaults file gives", () => {
  test("takes each setting's type from its default, and each pane key's and mark's from KINDS", () => {
    expect(
      shapeOf({ a: { b: 1, c: "x", d: true }, keys: { e: "q", f: 3 }, marks: { g: "x", h: { i: 1 } } }),
    ).toEqual({
      shape: {
        a: { b: "number", c: "string", d: "boolean" },
        keys: { e: "key", f: "key" },
        marks: { g: "mark", h: { i: "mark" } },
      },
    });
  });

  test("names a setting `constructor` or `toString` as any other", () => {
    expect(shapeOf({ keys: { e: "q" }, marks: MARKS, a: { constructor: "x", toString: 1 } })).toEqual({
      shape: { keys: { e: "key" }, marks: { m: "mark" }, a: { constructor: "string", toString: "number" } },
    });
  });

  test("is none where a default gives no type", () => {
    expect(shapeOf({ keys: { e: "q" }, marks: MARKS, a: { b: null, c: [1] }, d: null })).toEqual({
      problems: [`a.b is null, ${NO_TYPE}`, `a.c is a list, ${NO_TYPE}`, `d is null, ${NO_TYPE}`],
    });
  });

  test("is none where a section, or the file, holds no settings", () => {
    expect(shapeOf({ keys: {}, marks: MARKS })).toEqual({ problems: ["keys holds no settings"] });
    expect(shapeOf({ keys: { e: "q" }, marks: MARKS, a: {} })).toEqual({ problems: ["a holds no settings"] });
    expect(shapeOf({})).toEqual({ problems: ["the file holds no settings", NO_KEYS, NO_MARKS] });
  });

  test("is none where the file is no section", () => {
    expect(shapeOf(3)).toEqual({ problems: ["the file is number, not a section"] });
    expect(shapeOf([])).toEqual({ problems: ["the file is a list, not a section"] });
  });

  test("is none where a section KINDS names is missing, or is no section", () => {
    expect(shapeOf({ a: { b: 1 } })).toEqual({ problems: [NO_KEYS, NO_MARKS] });
    expect(shapeOf({ keys: { e: "q" }, a: { b: 1 } })).toEqual({ problems: [NO_MARKS] });
    expect(shapeOf({ keys: "q", marks: MARKS, a: { b: 1 } })).toEqual({
      problems: ["keys is string, not the section KINDS names"],
    });
    expect(shapeOf({ keys: null, marks: MARKS })).toEqual({
      problems: ["keys is null, not the section KINDS names"],
    });
    expect(shapeOf({ keys: { e: "q" }, marks: "x" })).toEqual({
      problems: ["marks is string, not the section KINDS names"],
    });
  });
});

describe("a hotkey bound twice", () => {
  test("is found among the settings the shape takes as hotkeys, and no other", () => {
    expect(
      clashesIn({ keys: { a: "key", b: "key" }, marks: { c: "string" } }, {
        keys: { a: "j", b: "j" },
        marks: { c: "j" },
      }),
    ).toEqual(['keys.a and keys.b are both "j"; each key presses one button']);
    expect(clashesIn(shape, shipped)).toEqual([]);
  });
});

describe("a null section", () => {
  test("reads as an empty one", () => {
    expect(nullSectionsEmptied(shape, { keys: null, notes: { rows: 2 } })).toEqual({
      keys: {},
      notes: { rows: 2 },
    });
  });
});

/** A sound user file, which these tests show gives no problems of its own. */
const SOUND_USER = { path: U, text: "keys:\n  help: x\nnotes:\n  rows: 5\n" };

describe("a defaults file that is missing, empty or gives no shape", () => {
  const cases: readonly (readonly [string, string | undefined, readonly string[]])[] = [
    ["missing", undefined, ["is missing"]],
    ["empty", "", ["the file holds no settings", NO_KEYS, NO_MARKS]],
    ["an empty section", "{}", ["the file holds no settings", NO_KEYS, NO_MARKS]],
    ["an empty keys section", '{"keys": {}, "marks": {"m": "x"}}', ["keys holds no settings"]],
    ["no marks section", '{"keys": {"help": "q"}}', [NO_MARKS]],
  ];

  for (const [name, text, problems] of cases) {
    test(`${name}: no settings, its problems alone, and a sound user file gives none`, () => {
      const got = loaded({ path: D, text }, SOUND_USER);
      expect(got).toEqual({
        settings: null,
        effective: [],
        problems: problems.map((line) => `${D}: ${line}`),
      });
      expect(got.problems.filter((line) => line.startsWith(U))).toEqual([]);
    });
  }

  test("the sound user file gives no problems under the shipped defaults either", () => {
    expect(loaded({ path: D, text: SHIPPED }, SOUND_USER).problems).toEqual([]);
  });
});

describe("a default named `constructor` or `toString`", () => {
  const defaults = { path: D, text: `${KINDS_YAML}misc:\n  constructor: x\n  toString: 1\n` };

  test("is in effect where the user's file leaves it out", () => {
    const got = loaded(defaults, { path: U, text: "misc:\n  toString: 2\n" });
    expect(got.problems).toEqual([]);
    expect(got.settings).toEqual({ keys: { help: "q" }, marks: MARKS, misc: { constructor: "x", toString: 2 } });
  });

  test("is checked where the user's file sets it", () => {
    expect(loaded(defaults, { path: U, text: "misc:\n  constructor: 3\n" }).problems).toEqual([
      `${U}: misc.constructor is number, not a string; quote it`,
    ]);
  });

  test("is no setting where the defaults file leaves it out", () => {
    const got = loaded(
      { path: D, text: `${KINDS_YAML}misc:\n  rows: 1\n` },
      { path: U, text: "misc:\n  rows: 2\n" },
    );
    expect(got.problems).toEqual([]);
    expect(got.settings).toEqual({ keys: { help: "q" }, marks: MARKS, misc: { rows: 2 } });
  });
});

describe("the type a default gives its setting", () => {
  const notes = isSection(shipped["notes"]) ? shipped["notes"] : {};
  const asString = stringify({ ...shipped, notes: { ...notes, rows: "3" } });

  test("is the setting's type: a number written as a string makes the setting a string", () => {
    expect(loaded({ path: D, text: asString }, { path: U, text: "notes:\n  rows: 5\n" }).problems).toEqual([
      `${U}: notes.rows is number, not a string; quote it`,
    ]);
    expect(
      loaded({ path: D, text: asString }, { path: U, text: 'notes:\n  rows: "5"\n' }).settings?.notes.rows,
    ).toBe("5");
  });

  test("is the setting's being one: a default added is a setting, and one left out is none", () => {
    const added = stringify({ ...shipped, notes: { ...notes, extra: true } });
    expect(loaded({ path: D, text: added }, { path: U, text: "notes:\n  extra: false\n" }).problems).toEqual([]);
    const withoutLint = Object.fromEntries(Object.entries(shipped).filter(([key]) => key !== "lint"));
    expect(
      loaded({ path: D, text: stringify(withoutLint) }, { path: U, text: "lint:\n  turn-end: false\n" }).problems,
    ).toEqual([
      `${U}: lint is no setting; the keys here are counts, keys, pane, notes, actions, marks, colors, roll-up`,
    ]);
  });
});

// The settings in effect over random user files: the shipped defaults
// changed at random, written as YAML, or text YAML refuses or reads oddly,
// under the shipped defaults and under defaults changed in one way each.

/** A value a setting might be given. */
const valueArb: fc.Arbitrary<Json> = fc.oneof(
  fc.string({ maxLength: 3 }),
  fc.constantFrom("q", "j", "k", "s", "r", "h", "x", "Q", "?", "jj", ""),
  fc.double(),
  fc.constantFrom(Infinity, -Infinity, NaN),
  fc.integer(),
  fc.boolean(),
  fc.constant(null),
  fc.array(fc.integer(), { maxLength: 2 }),
  fc.constant({}),
);

/** Keys no section or file holds, and keys a plain object inherits. */
const extraArb = fc.dictionary(
  fc.constantFrom("extra", "prev", "__proto__", "constructor", "toString"),
  valueArb,
  { maxKeys: 2 },
);

type Change = Readonly<{ kind: "keep" } | { kind: "drop" } | { kind: "set"; value: Json }>;

/** What a sparse user file does with one of the defaults' keys: mostly leaves it out. */
const changeArb: fc.Arbitrary<Change> = fc.oneof(
  { arbitrary: fc.constant({ kind: "drop" } as const), weight: 4 },
  { arbitrary: fc.constant({ kind: "keep" } as const), weight: 1 },
  { arbitrary: valueArb.map((value) => ({ kind: "set", value }) as const), weight: 2 },
);

/** `value` with each change made, in order, and the extra keys after. */
const changed = (
  value: { readonly [key: string]: Json },
  changes: readonly Change[],
  extra: { readonly [key: string]: Json },
): Json =>
  Object.fromEntries([
    ...Object.entries(value).flatMap(([key, inner], n): [string, Json][] => {
      const change = changes[n] ?? { kind: "drop" };

      return change.kind === "keep" ? [[key, inner]] : change.kind === "drop" ? [] : [[key, change.value]];
    }),
    ...Object.entries(extra),
  ]);

/** A section of the defaults, changed key by key, or left out, null or another type whole. */
const sectionArb = (section: Json): fc.Arbitrary<Change> =>
  isSection(section)
    ? fc.oneof(
        {
          arbitrary: fc
            .tuple(
              fc.array(changeArb, {
                minLength: Object.keys(section).length,
                maxLength: Object.keys(section).length,
              }),
              extraArb,
            )
            .map(([changes, extra]) => ({ kind: "set", value: changed(section, changes, extra) }) as const),
          weight: 4,
        },
        { arbitrary: fc.constant({ kind: "drop" } as const), weight: 3 },
        { arbitrary: fc.constant({ kind: "set", value: null } as const), weight: 1 },
        { arbitrary: valueArb.map((value) => ({ kind: "set", value }) as const), weight: 1 },
      )
    : changeArb;

/** A user file's text: the shipped defaults changed at random, written as YAML, or text YAML refuses or reads oddly. */
const userTextArb: fc.Arbitrary<string> = fc.oneof(
  {
    arbitrary: fc
      .tuple(fc.tuple(...Object.values(shipped).map(sectionArb)), extraArb)
      .map(([changes, extra]) => stringify(changed(shipped, changes, extra))),
    weight: 12,
  },
  { arbitrary: valueArb.map((value) => stringify(value)), weight: 1 },
  {
    arbitrary: fc.constantFrom(
      "",
      "---\n",
      "--- {}\n--- {}\n",
      "keys:\n  help: x\n  help: y\n",
      "marks:\n  sent: *x\n",
      "keys:\n",
      "notes:\n  rows: .inf\n",
      "<<: {}\n",
      "keys:\n  next: s\n",
      "[1, 2]\n",
    ),
    weight: 1,
  },
);

/** A sound user file's value: `value`'s sections and settings, some left out, a number one more and a boolean flipped. */
const soundArb = (value: Json): fc.Arbitrary<Json> =>
  isSection(value)
    ? fc
        .tuple(
          ...Object.entries(value).map(([key, inner]) =>
            fc.tuple(fc.constant(key), fc.boolean(), soundArb(inner)),
          ),
        )
        .map((entries) =>
          Object.fromEntries(entries.filter(([, isKept]) => isKept).map(([key, , inner]) => [key, inner])),
        )
    : typeof value === "number"
      ? fc.constantFrom(value, value + 1)
      : typeof value === "boolean"
        ? fc.constantFrom(value, !value)
        : fc.constant(value);

/** A user file's text: mostly one of userTextArb's, else a sound one. */
const anyUserTextArb: fc.Arbitrary<string> = fc.oneof(
  { arbitrary: userTextArb, weight: 3 },
  { arbitrary: soundArb(shipped).map((value) => stringify(value)), weight: 1 },
);

/** The shipped defaults with `section` replaced by `inner`, or left out where `inner` is undefined. */
const withSection = (section: string, inner: Json | undefined): { readonly [key: string]: Json } =>
  Object.fromEntries([
    ...Object.entries(shipped).flatMap(([key, value]): [string, Json][] =>
      key !== section ? [[key, value]] : inner === undefined ? [] : [[key, inner]],
    ),
    ...(inner !== undefined && !Object.hasOwn(shipped, section) ? [[section, inner] as [string, Json]] : []),
  ]);

const sectionOf = (name: string): { readonly [key: string]: Json } => {
  const inner = shipped[name];

  return isSection(inner) ? inner : {};
};

/**
 * A defaults file the random user files are read under, and what it does:
 * nothing but give the shipped settings; bind a key twice, so no settings
 * are in effect and the clash is said first; give no shape, so `loaded`
 * says only `problems` and checks no user file; or set a setting's type,
 * or whether it is one, in `section`, which changes nothing outside it.
 */
type Case = Readonly<{
  name: string;
  text: string | undefined;
  change:
    | Readonly<{ kind: "none" }>
    | Readonly<{ kind: "clashing"; clash: string }>
    | Readonly<{ kind: "unshaped"; problems: readonly string[] }>
    | Readonly<{
        kind: "retyped";
        section: string;
        value: { readonly [key: string]: Json };
      }>;
}>;

const retyped = (name: string, section: string, inner: Json | undefined): Case => {
  const value = withSection(section, inner);

  return { name, text: stringify(value), change: { kind: "retyped", section, value } };
};

const CASES: readonly Case[] = [
  { name: "shipped", text: SHIPPED, change: { kind: "none" } },
  {
    name: "binding a key twice",
    text: stringify(withSection("keys", { ...sectionOf("keys"), next: "s" })),
    change: { kind: "clashing", clash: 'keys.next and keys.submit are both "s"; each key presses one button' },
  },
  retyped("with a number default written as a string", "notes", { ...sectionOf("notes"), rows: "3" }),
  retyped("with a default added", "notes", { ...sectionOf("notes"), extra: true }),
  retyped("with a section left out", "lint", undefined),
  {
    name: "with a null default",
    text: stringify(withSection("counts", { ...sectionOf("counts"), turns: null })),
    change: { kind: "unshaped", problems: [`counts.turns is null, ${NO_TYPE}`] },
  },
  {
    name: "without the marks section, which KINDS names",
    text: stringify(withSection("marks", undefined)),
    change: { kind: "unshaped", problems: [NO_MARKS] },
  },
  { name: "missing", text: undefined, change: { kind: "unshaped", problems: ["is missing"] } },
  {
    name: "empty",
    text: "",
    change: { kind: "unshaped", problems: ["the file holds no settings", NO_KEYS, NO_MARKS] },
  },
  {
    name: "with an empty keys section",
    text: '{"keys": {}, "marks": {"m": "x"}}',
    change: { kind: "unshaped", problems: ["keys holds no settings"] },
  },
];

/** `settings` without `section`. */
const omitting = (settings: Loaded["settings"], section: string): Json | null =>
  settings === null ? null : Object.fromEntries(Object.entries(settings).filter(([key]) => key !== section));

/** `section` of `settings`, or undefined where there's none. */
const sectionIn = (settings: Loaded["settings"], section: string): unknown =>
  settings === null ? undefined : Object.entries(settings).find(([key]) => key === section)?.[1];

/** Whether a user file's value reaches `section`, or names a section `value` doesn't hold, whose problem lists every section. */
const touches = (text: string, value: { readonly [key: string]: Json }, section: string): boolean => {
  const user = parseYaml(text);

  return (
    "value" in user &&
    isSection(user.value) &&
    (Object.hasOwn(user.value, section) || Object.keys(user.value).some((key) => !Object.hasOwn(value, key)))
  );
};

const outside = (section: string) => (line: string) => !line.startsWith(`${section}.`);

/** Every shipped setting by its dotted key, with its default. */
const DEFAULT_LEAVES: ReadonlyMap<string, Json> = new Map(leaves(shipped));

/** Every setting a user file's text gives, by its dotted key; none where YAML refuses it. */
const givenIn = (text: string | undefined): ReadonlyMap<string, Json> => {
  const user = text === undefined ? undefined : parseYaml(text);

  return new Map(user !== undefined && "value" in user ? leaves(user.value) : []);
};

/**
 * What any user file leaves true under the shipped defaults: settings are
 * in effect, every problem names the user's file, every shipped setting is
 * in effect once, in order, with its default's type and either its default
 * or the user's value, one effective line each; and where the user's file
 * has no problem, every setting it gives is in effect.
 */
const holdsUnderShipped = (got: Loaded, userText: string | undefined): void => {
  const given = givenIn(userText);
  const inEffect = got.settings === null ? [] : leaves(got.settings as unknown as Json);

  expect(got.settings).not.toBeNull();
  expect(got.problems.filter((line) => !line.startsWith(`${U}: `))).toEqual([]);
  expect(inEffect.map(([key]) => key)).toEqual([...DEFAULT_LEAVES.keys()]);
  expect(got.effective.map((line) => line.split(" = ")[0])).toEqual([...DEFAULT_LEAVES.keys()]);
  inEffect.forEach(([key, value]) => {
    expect(typeof value).toBe(typeof DEFAULT_LEAVES.get(key));
    expect([DEFAULT_LEAVES.get(key), given.get(key)]).toContainEqual(value);
    if (got.problems.length === 0 && given.has(key)) {
      expect(value).toEqual(given.get(key));
    }
  });
};

describe("the settings in effect over random user files", () => {
  for (const { name, text, change } of CASES) {
    test(`under defaults ${name}`, () => {
      fc.assert(
        fc.property(fc.option(anyUserTextArb, { nil: undefined }), (userText) => {
          const user = userText === undefined ? undefined : { path: U, text: userText };
          const got = loaded({ path: D, text }, user);

          if (change.kind === "none") {
            holdsUnderShipped(got, userText);
          } else if (change.kind === "clashing") {
            expect(got.settings).toBeNull();
            expect(got.effective).toEqual([]);
            expect(got.problems[0]).toBe(`${D}: ${change.clash}`);
          } else if (change.kind === "unshaped") {
            expect(got).toEqual({
              settings: null,
              effective: [],
              problems: change.problems.map((line) => `${D}: ${line}`),
            });
          } else {
            const { section, value } = change;
            expect(got.problems.filter((line) => line.startsWith(`${D}:`))).toEqual([]);

            if (user !== undefined && !touches(user.text, value, section)) {
              const was = loaded({ path: D, text: SHIPPED }, user);
              expect(got.problems).toEqual(was.problems);
              expect(omitting(got.settings, section)).toEqual(omitting(was.settings, section));
              expect(sectionIn(got.settings, section)).toEqual(value[section]);
              expect(got.effective.filter(outside(section))).toEqual(was.effective.filter(outside(section)));
            }
          }
        }),
        { seed: 20261121, numRuns: 200 },
      );
    });
  }

  test("many random user files leave each altered section alone, so the closer check runs", () => {
    const texts = fc.sample(userTextArb, { seed: 20261121, numRuns: 200 });
    const alone = CASES.flatMap(({ change }) =>
      change.kind === "retyped"
        ? [texts.filter((text) => !touches(text, change.value, change.section)).length]
        : [],
    );
    expect(alone.filter((count) => count < 20)).toEqual([]);
  });

  test("many random user files are sound and set a setting, so every setting they give is checked in effect", () => {
    const sound = fc
      .sample(anyUserTextArb, { seed: 20261121, numRuns: 200 })
      .filter(
        (text) =>
          loaded({ path: D, text: SHIPPED }, { path: U, text }).problems.length === 0 &&
          [...givenIn(text).keys()].some((key) => DEFAULT_LEAVES.has(key)),
      );
    expect(sound.length).toBeGreaterThan(20);
  });

  test("the random user files reach every kind of problem", () => {
    const said = fc
      .sample(userTextArb, { seed: 20261121, numRuns: 1000 })
      .flatMap((text) => loaded({ path: D, text: SHIPPED }, { path: U, text }).problems);
    const kinds = [
      "is no setting",
      "not a section",
      "not a number",
      "not a string",
      "not true or false",
      "not a finite number",
      "not one lowercase letter or digit",
      "not a mark",
      "each key presses one button",
      "YAML documents",
    ];
    expect(kinds.filter((kind) => !said.some((line) => line.includes(kind)))).toEqual([]);
  });
});
