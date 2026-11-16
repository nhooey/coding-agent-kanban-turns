// The settings: the shipped defaults file is complete and sound, and the
// user's file merges over it as defaults/config.jsonc says.

import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { expect } from "expect";

import {
  DEFAULTS_FILE,
  SETTINGS_SHAPE,
  expandHome,
  jsonOf,
  leaves,
  loaded,
  mergedOver,
  parseJsonc,
  problemsIn,
  userConfigPath,
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
    const got = loaded(defaults, user('{"keys": {"dismiss": "x"}, // mine\n}'));
    expect(got.problems).toEqual([]);
    expect(got.settings?.keys).toEqual({ prev: "h", skip: "j", next: "l", dismiss: "x" });
    expect(got.effective).toContain('keys.dismiss = "x"  # user: ~/.config/x/config.jsonc');
    expect(got.effective).toContain('keys.prev = "h"  # defaults: defaults/config.jsonc');
  });

  test("an unknown key refuses the file, which leaves the defaults in effect", () => {
    const got = loaded(defaults, user('{"keys": {"dimiss": "x"}}'));
    expect(got.settings?.keys.dismiss).toBe("q");
    expect(got.problems).toEqual([
      "~/.config/x/config.jsonc: keys.dimiss is no setting; the keys here are prev, skip, next, dismiss",
    ]);
  });

  test("a value of the wrong type refuses the file", () => {
    const got = loaded(defaults, user('{"outstanding": {"timeout-ms": "soon"}}'));
    expect(got.problems).toEqual([
      "~/.config/x/config.jsonc: outstanding.timeout-ms is string, not a number",
    ]);
  });

  test("a file that isn't JSONC is named with why", () => {
    expect(loaded(defaults, user("{")).problems[0]).toMatch(/^~\/\.config\/x\/config\.jsonc: /);
  });

  test("a broken defaults file leaves no settings at all", () => {
    const got = loaded({ path: "d", text: '{"keys": {}}' }, undefined);
    expect(got.settings).toBeNull();
    expect(got.problems).toContain("d: outstanding is missing");
  });
});

describe("the pieces", () => {
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

  test("a leading ~/ is the home directory", () => {
    expect(expandHome("~/a/b", "/h")).toBe("/h/a/b");
    expect(expandHome("/a/~/b", "/h")).toBe("/a/~/b");
    expect(expandHome("~/a", undefined)).toBe("~/a");
  });
});
