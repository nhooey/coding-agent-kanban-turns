// The settings: the shipped defaults file is complete and sound, and the
// user's file merges over it as defaults/config.yaml says.

import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { expect } from "expect";
import { isMap, isScalar, parseDocument } from "yaml";
import type { YAMLMap } from "yaml";

import {
  DEFAULTS_FILE,
  leaves,
  loaded,
  mergedOver,
  parseYaml,
  problemsIn,
  userConfigPath,
} from "../../../src/config/config.ts";
import { SETTINGS_SHAPE } from "../../fixtures/settings-shape.ts";

const defaultsText = readFileSync(
  new URL(`../../../${DEFAULTS_FILE}`, import.meta.url),
  "utf8",
);
const defaults = { path: "defaults/config.yaml", text: defaultsText };
const user = (text: string) => ({ path: "~/.config/x/config.yaml", text });

describe("the shipped defaults file", () => {
  test("is YAML, and holds every setting the shape names and no other", () => {
    expect(DEFAULTS_FILE).toBe("defaults/config.yaml");
    const parsed = parseYaml(defaultsText);
    expect(parsed).toHaveProperty("value");
    expect("value" in parsed && problemsIn(SETTINGS_SHAPE, parsed.value, false)).toEqual([]);
  });

  test("has a comment over every setting and every section", () => {
    // The parser keeps a comment over a key on the key, except over a
    // section's first key, which it keeps on the section.
    const uncommented = (map: YAMLMap, path: readonly string[]): readonly string[] =>
      map.items.flatMap((pair, n) => {
        const key = isScalar(pair.key) ? String(pair.key.value) : "?";
        const comment = pair.key && isScalar(pair.key) ? pair.key.commentBefore : undefined;
        const here = comment || (n === 0 ? map.commentBefore : undefined);

        return [
          ...(here ? [] : [[...path, key].join(".")]),
          ...(isMap(pair.value) ? uncommented(pair.value, [...path, key]) : []),
        ];
      });
    const document = parseDocument(defaultsText);
    expect(isMap(document.contents)).toBe(true);
    expect(isMap(document.contents) ? uncommented(document.contents, []) : []).toEqual([]);
  });

  test("with no user file, is what's in effect", () => {
    const got = loaded(defaults, undefined);
    expect(got.problems).toEqual([]);
    expect(got.settings?.keys.help).toBe("h");
    expect(got.effective).toContain(
      'keys.help = "h"  # defaults: defaults/config.yaml',
    );
  });

  test("with an empty user file, gives exactly the defaults", () => {
    expect(loaded(defaults, user("{}")).settings).toEqual(
      loaded(defaults, undefined).settings,
    );
  });

  test("with a user file of comments alone, gives exactly the defaults", () => {
    const got = loaded(defaults, user("# nothing set yet\n"));
    expect(got.problems).toEqual([]);
    expect(got.settings).toEqual(loaded(defaults, undefined).settings);
  });
});

describe("the user's file over the defaults", () => {
  test("changes only the keys it names, and says where each came from", () => {
    const got = loaded(defaults, user("keys:\n  help: x\ncolors:\n  kanban: red # mine\n"));
    expect(got.problems).toEqual([]);
    expect(got.settings?.keys).toMatchObject({ help: "x", next: "j" });
    expect(got.settings?.colors.kanban).toBe("red");
    expect(got.settings?.colors["title-label"]).toBe("inverseText");
    expect(got.effective).toContain('keys.help = "x"  # user: ~/.config/x/config.yaml');
    expect(got.effective).toContain('colors.title-label = "inverseText"  # defaults: defaults/config.yaml');
  });

  test("an unknown key refuses the file, which leaves the defaults in effect", () => {
    const got = loaded(defaults, user('{"keys": {"prev": "h"}}'));
    expect(got.settings?.keys.help).toBe("h");
    expect(got.problems).toEqual([
      "~/.config/x/config.yaml: keys.prev is no setting; the keys here are next, previous, submit, reassess, help",
    ]);
  });

  test("a value of the wrong type refuses the file", () => {
    const got = loaded(defaults, user('{"counts": {"turns": "all"}}'));
    expect(got.problems).toEqual([
      "~/.config/x/config.yaml: counts.turns is string, not a number",
    ]);
  });

  test("the hover bar's colour is a setting like the others", () => {
    expect(loaded(defaults, undefined).settings?.colors.hover).toBe("suggestion");
    const got = loaded(defaults, user('{"colors": {"hover": "claude"}}'));
    expect(got.problems).toEqual([]);
    expect(got.settings?.colors.hover).toBe("claude");
    expect(got.settings?.colors["title-label"]).toBe("inverseText");
    expect(loaded(defaults, user('{"colors": {"hover": 3}}')).problems).toEqual([
      "~/.config/x/config.yaml: colors.hover is number, not a string; quote it",
    ]);
  });

  test("the title label's, the settled bar's and the Kanban button's colours are settings", () => {
    expect(loaded(defaults, undefined).settings?.colors).toMatchObject({
      "title-label": "inverseText",
      "title-background": "claude",
      settled: "ide",
      kanban: "claude",
    });
    const got = loaded(defaults, user('{"colors": {"settled": "permission", "kanban": "warning"}}'));
    expect(got.problems).toEqual([]);
    expect(got.settings?.colors.settled).toBe("permission");
    expect(got.settings?.colors.kanban).toBe("warning");
    expect(loaded(defaults, user('{"colors": {"settled": true}}')).problems).toEqual([
      "~/.config/x/config.yaml: colors.settled is boolean, not a string; quote it",
    ]);
  });

  test("the pane's keys are settings, one each", () => {
    expect(loaded(defaults, undefined).settings?.keys).toEqual({
      next: "j",
      previous: "k",
      submit: "s",
      reassess: "r",
      help: "h",
    });
    expect(loaded(defaults, user('{"keys": {"submit": "x"}}')).settings?.keys.submit).toBe("x");
  });

  test("a key the engine wouldn't take as a hotkey refuses the file, since it would blank the pane", () => {
    expect(loaded(defaults, user('{"keys": {"help": "?"}}')).problems).toEqual([
      '~/.config/x/config.yaml: keys.help is "?", not one lowercase letter or digit, as the pane\'s keys must be',
    ]);
    expect(loaded(defaults, user('{"keys": {"submit": "S"}}')).settings?.keys.submit).toBe("s");
    expect(loaded(defaults, user('{"keys": {"submit": 3}}')).problems).toEqual([
      "~/.config/x/config.yaml: keys.submit is number, not one lowercase letter or digit, as the pane's keys must be",
    ]);
  });

  test("two buttons on one key refuse the file, which binds it to a default's key or its own", () => {
    const clash = loaded(defaults, user('{"keys": {"submit": "j"}}'));
    expect(clash.settings?.keys.submit).toBe("s");
    expect(clash.problems).toEqual([
      '~/.config/x/config.yaml: keys.next and keys.submit are both "j"; each key presses one button',
    ]);
    expect(clash.effective).toContain('keys.submit = "s"  # defaults: defaults/config.yaml');
    // Swapping two keys clashes with neither.
    const swapped = loaded(defaults, user('{"keys": {"next": "k", "previous": "j"}}'));
    expect(swapped.problems).toEqual([]);
    expect(swapped.settings?.keys.next).toBe("k");
  });

  test("pane.hints refuses the file by the unknown key's own message, as any key the defaults don't hold does", () => {
    const got = loaded(defaults, user('{"pane": {"hints": false}, "keys": {"help": "o"}}'));
    expect(got.settings?.keys.help).toBe("h");
    expect(got.problems).toEqual([
      "~/.config/x/config.yaml: pane.hints is no setting; the keys here are close-when-all-submitted",
    ]);
  });

  test("a section or a key the defaults don't hold, at any depth, is an unknown key, the file refused whole", () => {
    const unknown = {
      backlog: '{"backlog": {}}',
      "colors.halo": '{"colors": {"halo": "red"}}',
      "keys.quit": '{"keys": {"quit": "x"}}',
      "marks.buttons.skip": '{"marks": {"buttons": {"skip": "X"}}}',
    };
    Object.entries(unknown).forEach(([key, text]) => {
      const got = loaded(defaults, user(text));
      expect(got.settings).toEqual(loaded(defaults, undefined).settings);
      expect(got.problems).toEqual([
        expect.stringMatching(
          new RegExp(`^~/\\.config/x/config\\.yaml: ${key.replaceAll(".", "\\.")} is no setting; the keys here are `),
        ),
      ]);
    });
  });

  test("whether Submit closes the pane once nothing is left open is a boolean setting, on by default", () => {
    const got = loaded(defaults, undefined);
    expect(got.settings?.pane["close-when-all-submitted"]).toBe(true);
    expect(got.effective).toContain(
      "pane.close-when-all-submitted = true  # defaults: defaults/config.yaml",
    );
    const off = loaded(defaults, user("pane:\n  close-when-all-submitted: false\n"));
    expect(off.problems).toEqual([]);
    expect(off.settings?.pane["close-when-all-submitted"]).toBe(false);
    expect(loaded(defaults, user("pane:\n  close-when-all-submitted: no\n")).problems).toEqual([
      "~/.config/x/config.yaml: pane.close-when-all-submitted is string, not true or false",
    ]);
  });

  test("whether the turn's end lints the final response is a boolean setting, on by default", () => {
    const got = loaded(defaults, undefined);
    expect(got.settings?.lint["turn-end"]).toBe(true);
    expect(got.effective).toContain("lint.turn-end = true  # defaults: defaults/config.yaml");
    const off = loaded(defaults, user("lint:\n  turn-end: false\n"));
    expect(off.problems).toEqual([]);
    expect(off.settings?.lint["turn-end"]).toBe(false);
  });

  test("how wide a summary in the roll-up's draft may be is a number setting, 100 by default", () => {
    const got = loaded(defaults, undefined);
    expect(got.settings?.["roll-up"]["summary-width"]).toBe(100);
    expect(loaded(defaults, user("roll-up:\n  summary-width: 60\n")).settings?.["roll-up"]).toEqual({
      "summary-width": 60,
    });
  });

  test("the notes field's rows are a setting", () => {
    expect(loaded(defaults, undefined).settings?.notes).toEqual({ rows: 3 });
    expect(loaded(defaults, user('{"notes": {"rows": 5}}')).settings?.notes.rows).toBe(5);
    expect(loaded(defaults, user('{"notes": {"rows": "many"}}')).problems).toEqual([
      "~/.config/x/config.yaml: notes.rows is string, not a number",
    ]);
  });

  test("two unknown keys in two sections refuse the file, with both said", () => {
    const got = loaded(defaults, user('{"backlog": {}, "keys": {"prev": "h"}}'));
    expect(got.settings?.keys.help).toBe("h");
    expect(got.problems).toHaveLength(2);
  });

  test("the count line's window and gh's time are settings", () => {
    expect(loaded(defaults, undefined).settings?.counts).toEqual({ turns: 20, "gh-timeout-ms": 20000 });
  });

  test("a file that isn't YAML is named with why", () => {
    expect(loaded(defaults, user("{")).problems[0]).toMatch(/^~\/\.config\/x\/config\.yaml: /);
  });

  test("an implicitly typed scalar keeps the type the defaults give its key, or refuses the file", () => {
    // YAML 1.2's core schema: `on` and `yes` are strings, `1.10` is a number.
    const strings = loaded(defaults, user("colors:\n  kanban: on\nmarks:\n  sent: yes\n"));
    expect(strings.problems).toEqual([]);
    expect(strings.settings?.colors.kanban).toBe("on");
    expect(strings.settings?.marks.sent).toBe("yes");
    expect(loaded(defaults, user("colors:\n  kanban: 1.10\n")).problems).toEqual([
      "~/.config/x/config.yaml: colors.kanban is number, not a string; quote it",
    ]);
    expect(loaded(defaults, user("notes:\n  rows: on\n")).problems).toEqual([
      "~/.config/x/config.yaml: notes.rows is string, not a number",
    ]);
  });

  test("a key written twice refuses the file", () => {
    const got = loaded(defaults, user("keys:\n  help: x\n  help: y\n"));
    expect(got.settings?.keys.help).toBe("h");
    expect(got.problems).toEqual([
      "~/.config/x/config.yaml: Map keys must be unique at line 3, column 3",
    ]);
  });

  test("a tag outside the core schema refuses the file", () => {
    expect(loaded(defaults, user("keys:\n  help: !!binary eA==\n")).problems).toEqual([
      "~/.config/x/config.yaml: Unresolved tag: tag:yaml.org,2002:binary at line 2, column 9",
    ]);
  });

  test("more than one document refuses the file", () => {
    expect(loaded(defaults, user("keys: {}\n---\nkeys: {}\n")).problems).toEqual([
      "~/.config/x/config.yaml: holds 2 YAML documents, not one",
    ]);
  });

  test("a __proto__ or constructor key is no setting", () => {
    const shape = "is no setting; the keys here are next, previous, submit, reassess, help";
    expect(loaded(defaults, user('keys:\n  __proto__:\n    help: x\n')).problems).toEqual([
      `~/.config/x/config.yaml: keys.__proto__ ${shape}`,
    ]);
    expect(loaded(defaults, user("keys:\n  constructor: x\n")).problems).toEqual([
      `~/.config/x/config.yaml: keys.constructor ${shape}`,
    ]);
  });

  test("a section with every key under it commented out is an empty section", () => {
    const got = loaded(defaults, user("keys:\n  # help: x\nnotes:\n  rows: 5\n"));
    expect(got.problems).toEqual([]);
    expect(got.settings?.keys.help).toBe("h");
    expect(got.settings?.notes.rows).toBe(5);
  });

  test("an empty document, after a --- or before a ..., with comments or none, is an empty file", () => {
    const empty = loaded(defaults, undefined).settings;
    for (const text of ["---\n# nothing set yet\n", "---\n", "...\n", "# mine\n...\n"]) {
      const got = loaded(defaults, user(text));
      expect(got.problems).toEqual([]);
      expect(got.settings).toEqual(empty);
    }
  });

  test("a YAML version the parser doesn't know is refused, with a document or none", () => {
    expect(loaded(defaults, user("%YAML 9.9\n")).problems).toEqual([
      "~/.config/x/config.yaml: Unsupported YAML version 9.9",
    ]);
    expect(loaded(defaults, user("%YAML 9.9\n---\nkeys: {}\n")).problems).toEqual([
      "~/.config/x/config.yaml: Unsupported YAML version 9.9 at line 1, column 7",
    ]);
  });

  test("a %YAML 1.1 directive still reads under the core schema, so on stays a string", () => {
    const got = loaded(defaults, user("%YAML 1.1\n---\ncolors:\n  kanban: on\n"));
    expect(got.problems).toEqual([]);
    expect(got.settings?.colors.kanban).toBe("on");
  });

  test("a local tag refuses the file", () => {
    expect(loaded(defaults, user("colors:\n  kanban: !mine red\n")).problems).toEqual([
      "~/.config/x/config.yaml: Unresolved tag: !mine at line 2, column 11",
    ]);
  });

  test("a << is an ordinary key, so no merge happens and the file is refused", () => {
    expect(loaded(defaults, user("keys:\n  <<: {help: x}\n")).problems).toEqual([
      "~/.config/x/config.yaml: keys.<< is no setting; the keys here are next, previous, submit, reassess, help",
    ]);
  });

  test(".nan and .inf are no number a setting takes", () => {
    expect(loaded(defaults, user("counts:\n  turns: .inf\n")).problems).toEqual([
      "~/.config/x/config.yaml: counts.turns is .inf, not a finite number",
    ]);
    expect(loaded(defaults, user("notes:\n  rows: .nan\n")).problems).toEqual([
      "~/.config/x/config.yaml: notes.rows is .nan, not a finite number",
    ]);
    expect(loaded(defaults, user("counts:\n  gh-timeout-ms: -.inf\n")).problems).toEqual([
      "~/.config/x/config.yaml: counts.gh-timeout-ms is -.inf, not a finite number",
    ]);
  });

  test("a string setting given a number or a boolean asks for quotes, and one given a section or a list doesn't", () => {
    expect(loaded(defaults, user("marks:\n  sent: true\n")).problems).toEqual([
      "~/.config/x/config.yaml: marks.sent is boolean, not a string; quote it",
    ]);
    expect(loaded(defaults, user("marks:\n  sent: {a: b}\n")).problems).toEqual([
      "~/.config/x/config.yaml: marks.sent is object, not a string",
    ]);
    expect(loaded(defaults, user("marks:\n  sent: [a]\n")).problems).toEqual([
      "~/.config/x/config.yaml: marks.sent is a list, not a string",
    ]);
  });

  test("a parse error beside an alias to no anchor is the parse error that's said", () => {
    expect(loaded(defaults, user("keys:\n  help: *x\n  help: y\n")).problems).toEqual([
      "~/.config/x/config.yaml: Map keys must be unique at line 3, column 3",
    ]);
    expect(loaded(defaults, user("keys: [\nnotes: *x\n")).problems).toEqual([
      "~/.config/x/config.yaml: Flow sequence in block collection must be sufficiently indented and end with a ] at line 2, column 1",
    ]);
  });

  test("an alias to no anchor, alone, refuses the file", () => {
    expect(loaded(defaults, user("marks:\n  sent: *x\n")).problems).toEqual([
      "~/.config/x/config.yaml: Unresolved alias (the anchor must be set before the alias): x",
    ]);
  });

  test("a broken defaults file leaves no settings at all", () => {
    const got = loaded({ path: "d", text: '{"keys": {}, "marks": {"m": "x"}}' }, undefined);
    expect(got.settings).toBeNull();
    expect(got.problems).toEqual(["d: keys holds no settings"]);
  });

  test("a defaults file with a null default leaves no settings, and the user's file unchecked", () => {
    const got = loaded({ path: "d", text: '{"keys": {"help": "q"}, "marks": {"m": "x"}, "counts": {"turns": null}}' }, user('{"keys": {"x": "y"}}'));
    expect(got.settings).toBeNull();
    expect(got.problems).toEqual([
      "d: counts.turns is null, so its default gives it no type; write a string, a number, or true or false, or name its section's type in KINDS in src/config/config.ts",
    ]);
  });
});

describe("a config.yaml written as JSON", () => {
  test("reads with tabs inside a multi-line flow mapping", () => {
    const nested = '{\n\t"keys": {\n\t\t"help": "x",\n\t\t"next": "n"\n\t},\n\t"colors": {\n\t\t"kanban": "red"\n\t}\n}\n';
    const got = loaded(defaults, user(nested));
    expect(got.problems).toEqual([]);
    expect(got.settings).toMatchObject({
      keys: { help: "x", next: "n" },
      colors: { kanban: "red" },
    });
  });

  test("reads minified onto one line past YAML's 1024 characters for an implicit key", () => {
    const everything = loaded(defaults, undefined).settings;
    const long = { ...everything, marks: { ...everything?.marks, sent: "☑".repeat(2000) } };
    const minified = JSON.stringify(long);
    expect(minified.length).toBeGreaterThan(2000);
    expect(minified).not.toContain("\n");
    const got = loaded(defaults, user(minified));
    expect(got.problems).toEqual([]);
    expect(got.settings).toEqual(long);
  });

  test("reads with a trailing comma in a flow map and in a flow list", () => {
    const map = loaded(defaults, user('{"keys": {"help": "x",}, "notes": {"rows": 5,},}'));
    expect(map.problems).toEqual([]);
    expect(map.settings?.keys.help).toBe("x");
    expect(map.settings?.notes.rows).toBe(5);
    // The list parses, so the one problem is that no setting takes a list.
    expect(loaded(defaults, user('{"marks": {"sent": ["a", "b",]}}')).problems).toEqual([
      "~/.config/x/config.yaml: marks.sent is a list, not a string",
    ]);
    // The trailing comma ends the list: it adds no null after the last item.
    expect(parseYaml("[1, 2,]")).toEqual({ value: [1, 2] });
  });

  test("keeps # and : inside a double-quoted string", () => {
    const got = loaded(defaults, user('{"marks": {"sent": "# not: a comment"}} # but this'));
    expect(got.problems).toEqual([]);
    expect(got.settings?.marks.sent).toBe("# not: a comment");
  });

  test("reads # comment lines inside a flow mapping", () => {
    const got = loaded(defaults, user('{\n  "keys": {"help": "x"},\n  # mine\n  "notes": {"rows": 5}\n}'));
    expect(got.problems).toEqual([]);
    expect(got.settings?.keys.help).toBe("x");
    expect(got.settings?.notes.rows).toBe(5);
  });

  test("refuses a key written twice in a flow mapping, placed by line and column", () => {
    expect(loaded(defaults, user('{"keys": {"help": "x", "help": "y"}}')).problems).toEqual([
      "~/.config/x/config.yaml: Map keys must be unique at line 1, column 24",
    ]);
    expect(loaded(defaults, user('{\n  "keys": {"help": "x"},\n  "keys": {}\n}')).problems).toEqual([
      "~/.config/x/config.yaml: Map keys must be unique at line 3, column 3",
    ]);
  });

  test("refuses a comment with no whitespace before it", () => {
    const got = loaded(defaults, user('{"keys": {"help": "x"},# mine\n}'));
    expect(got.settings?.keys.help).toBe("h");
    expect(got.problems).toEqual([
      "~/.config/x/config.yaml: Comments must be separated from other tokens by white space characters at line 1, column 24",
    ]);
  });
});

describe("the pieces", () => {
  test("a boolean that isn't one names what it takes", () => {
    expect(problemsIn("boolean", "no", false, ["pane", "close-when-all-submitted"])).toEqual([
      "pane.close-when-all-submitted is string, not true or false",
    ]);
  });

  test("YAML: a document's value, an empty one as an empty section, and JSON as YAML reads it", () => {
    expect(parseYaml("a:\n  b: [1, x]\n")).toEqual({ value: { a: { b: [1, "x"] } } });
    expect(parseYaml("")).toEqual({ value: {} });
    expect(parseYaml('{"a": 1}')).toEqual({ value: { a: 1 } });
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

  test("the user's file is config.yaml under XDG_CONFIG_HOME, else ~/.config, and no other", () => {
    expect(userConfigPath({ xdgConfigHome: "/x", home: "/h" })).toBe(
      "/x/coding-agent-kanban-turns/config.yaml",
    );
    expect(userConfigPath({ home: "/h" })).toBe(
      "/h/.config/coding-agent-kanban-turns/config.yaml",
    );
    expect(userConfigPath({})).toBeUndefined();
  });
});
