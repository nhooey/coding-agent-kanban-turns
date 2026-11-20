// The settings: the shipped defaults file is complete and sound, and the
// user's file merges over it as defaults/config.jsonc says.

import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { expect } from "expect";

import {
  DEFAULTS_FILE,
  SETTINGS_SHAPE,
  jsonOf,
  leaves,
  loaded,
  mergedOver,
  parseJsonc,
  problemsIn,
  retiredIn,
  userConfigPath,
  withoutRetired,
} from "../src/config.ts";

const defaultsText = readFileSync(
  new URL(`../${DEFAULTS_FILE}`, import.meta.url),
  "utf8",
);
const defaults = { path: "defaults/config.jsonc", text: defaultsText };
const user = (text: string) => ({ path: "~/.config/x/config.jsonc", text });

describe("the shipped defaults file", () => {
  test("parses, and holds every setting the shape names and no other", () => {
    const parsed = parseJsonc(defaultsText);
    expect("value" in parsed && problemsIn(SETTINGS_SHAPE, parsed.value, false)).toEqual([]);
  });

  test("has a comment over every setting and every section", () => {
    const lines = defaultsText.split("\n");
    const uncommented = lines
      .map((line, n) => ({ line, above: lines[n - 1] ?? "" }))
      .filter(({ line }) => /^\s*"[^"]+":/.test(line))
      .filter(({ above }) => !/^\s*\/\//.test(above))
      .map(({ line }) => line.trim());
    expect(uncommented).toEqual([]);
  });

  test("with no user file, is what's in effect", () => {
    const got = loaded(defaults, undefined);
    expect(got.problems).toEqual([]);
    expect(got.settings?.keys.dismiss).toBe("q");
    expect(got.effective).toContain(
      'keys.dismiss = "q"  # defaults: defaults/config.jsonc',
    );
  });

  test("with an empty user file, gives exactly the defaults", () => {
    expect(loaded(defaults, user("{}")).settings).toEqual(
      loaded(defaults, undefined).settings,
    );
  });
});

describe("the user's file over the defaults", () => {
  test("changes only the keys it names, and says where each came from", () => {
    const got = loaded(defaults, user('{"keys": {"dismiss": "x"}, "colors": {"kanban": "red"}, // mine\n}'));
    expect(got.problems).toEqual([]);
    expect(got.settings?.keys).toEqual({ dismiss: "x" });
    expect(got.settings?.colors.kanban).toBe("red");
    expect(got.settings?.colors.title).toBe("inverseText");
    expect(got.effective).toContain('keys.dismiss = "x"  # user: ~/.config/x/config.jsonc');
    expect(got.effective).toContain('colors.title = "inverseText"  # defaults: defaults/config.jsonc');
  });

  test("an unknown key refuses the file, which leaves the defaults in effect", () => {
    const got = loaded(defaults, user('{"keys": {"prev": "h"}}'));
    expect(got.settings?.keys.dismiss).toBe("q");
    expect(got.problems).toEqual([
      "~/.config/x/config.jsonc: keys.prev is no setting; the keys here are dismiss",
    ]);
  });

  test("a value of the wrong type refuses the file", () => {
    const got = loaded(defaults, user('{"counts": {"turns": "all"}}'));
    expect(got.problems).toEqual([
      "~/.config/x/config.jsonc: counts.turns is string, not a number",
    ]);
  });

  test("the hover bar's colour is a setting like the others", () => {
    expect(loaded(defaults, undefined).settings?.colors.hover).toBe("suggestion");
    const got = loaded(defaults, user('{"colors": {"hover": "claude"}}'));
    expect(got.problems).toEqual([]);
    expect(got.settings?.colors.hover).toBe("claude");
    expect(got.settings?.colors.title).toBe("inverseText");
    expect(loaded(defaults, user('{"colors": {"hover": 3}}')).problems).toEqual([
      "~/.config/x/config.jsonc: colors.hover is number, not a string",
    ]);
  });

  test("a section the plugin no longer reads is left out with a warning, and the rest of the file used", () => {
    const got = loaded(
      defaults,
      user('{"outstanding": {"script": "~/x.py", "python": "python3"}, "keys": {"dismiss": "x"}}'),
    );
    expect(got.settings?.keys.dismiss).toBe("x");
    expect(got.settings).not.toHaveProperty("outstanding");
    expect(got.problems).toEqual([
      "~/.config/x/config.jsonc: outstanding is no longer read and is left out: the plugin reads the transcript itself; counts.turns sets how many turns the count line reads",
    ]);
    expect(got.effective.some((line) => line.startsWith("outstanding."))).toBe(false);
  });

  test("a setting the plugin no longer reads is left out with a warning, its section's other keys used", () => {
    const got = loaded(defaults, user('{"colors": {"expand": "red", "title": "warning"}}'));
    expect(got.settings?.colors.title).toBe("warning");
    expect(got.settings?.colors).not.toHaveProperty("expand");
    expect(got.problems).toEqual([
      "~/.config/x/config.jsonc: colors.expand is no longer read and is left out: the ↗ beside the count line is gone; colors.kanban colours the 🖥️ Kanban button that opens the pane",
    ]);
  });

  test("the title label's, the settled bar's, the close button's and the Kanban button's colours are settings", () => {
    expect(loaded(defaults, undefined).settings?.colors).toMatchObject({
      title: "inverseText",
      "title-background": "claude",
      settled: "ide",
      close: "error",
      "close-x": "inverseText",
      kanban: "claude",
    });
    const got = loaded(defaults, user('{"colors": {"settled": "permission", "close": "warning"}}'));
    expect(got.problems).toEqual([]);
    expect(got.settings?.colors.settled).toBe("permission");
    expect(got.settings?.colors.close).toBe("warning");
    expect(loaded(defaults, user('{"colors": {"settled": true}}')).problems).toEqual([
      "~/.config/x/config.jsonc: colors.settled is boolean, not a string",
    ]);
  });

  test("the notes field's rows are a setting", () => {
    expect(loaded(defaults, undefined).settings?.notes).toEqual({ rows: 3 });
    expect(loaded(defaults, user('{"notes": {"rows": 5}}')).settings?.notes.rows).toBe(5);
    expect(loaded(defaults, user('{"notes": {"rows": "many"}}')).problems).toEqual([
      "~/.config/x/config.jsonc: notes.rows is string, not a number",
    ]);
  });

  test("a retired section beside a broken key still refuses the file, with both said", () => {
    const got = loaded(defaults, user('{"outstanding": {}, "keys": {"prev": "h"}}'));
    expect(got.settings?.keys.dismiss).toBe("q");
    expect(got.problems).toHaveLength(2);
  });

  test("the count line's window and gh's time are settings", () => {
    expect(loaded(defaults, undefined).settings?.counts).toEqual({ turns: 20, "gh-timeout-ms": 20000 });
  });

  test("a file that isn't JSONC is named with why", () => {
    expect(loaded(defaults, user("{")).problems[0]).toMatch(/^~\/\.config\/x\/config\.jsonc: /);
  });

  test("a broken defaults file leaves no settings at all", () => {
    const got = loaded({ path: "d", text: '{"keys": {}}' }, undefined);
    expect(got.settings).toBeNull();
    expect(got.problems).toContain("d: counts is missing");
  });
});

describe("the pieces", () => {
  test("a retired setting goes and its section stays; a file without it is unchanged", () => {
    expect(withoutRetired({ colors: { expand: "x", title: "y" }, outstanding: {}, keys: {} })).toEqual({
      colors: { title: "y" },
      keys: {},
    });
    expect(withoutRetired({ colors: "x" })).toEqual({ colors: "x" });
    expect(retiredIn({ colors: { title: "y" } })).toEqual([]);
    expect(retiredIn(null)).toEqual([]);
  });

  test("comments and trailing commas go; strings keep theirs", () => {
    expect(JSON.parse(jsonOf('{"a": "// no", /* x */ "b": [1,],\n// c\n}'))).toEqual({
      a: "// no",
      b: [1],
    });
  });

  test("maps merge key by key, and lists and scalars replace", () => {
    expect(mergedOver({ a: { b: 1, c: [1, 2] }, d: "x" }, { a: { c: [3] } })).toEqual({
      a: { b: 1, c: [3] },
      d: "x",
    });
  });

  test("every leaf by its dotted key", () => {
    expect(leaves({ a: { b: 1 }, c: "x" })).toEqual([
      ["a.b", 1],
      ["c", "x"],
    ]);
  });

  test("the user's file is under XDG_CONFIG_HOME, else ~/.config", () => {
    expect(userConfigPath({ xdgConfigHome: "/x", home: "/h" })).toBe(
      "/x/coding-agent-kanban-turns/config.jsonc",
    );
    expect(userConfigPath({ home: "/h" })).toBe(
      "/h/.config/coding-agent-kanban-turns/config.jsonc",
    );
    expect(userConfigPath({})).toBeUndefined();
  });
});
