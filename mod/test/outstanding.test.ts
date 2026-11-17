// Running outstanding.py: the script's path and argv the settings make, and
// what a run's exit code, stdout and stderr come to.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  NOTHING,
  failedRun,
  foundFrom,
  missingScript,
  outstandingArgv,
  scriptPath,
  withProblems,
} from "../src/outstanding.ts";

const outstanding = {
  script: "~/skills/outstanding.py",
  python: "python3",
  "timeout-ms": 20000,
};

const item = {
  turn: "abcd1234",
  number: 1,
  summary: "Pick one",
  kind: "radio",
  options: [{ letter: "A", name: "First" }],
};

const ran = (exitCode: number, stdout: string, stderr = "") => ({
  exitCode,
  stdout,
  stderr,
});

describe("scriptPath", () => {
  test("reads a leading ~/ as the home directory", () => {
    expect(scriptPath(outstanding, "/home/me")).toBe(
      "/home/me/skills/outstanding.py",
    );
  });

  test("leaves the path alone without a home directory", () => {
    expect(scriptPath(outstanding, undefined)).toBe("~/skills/outstanding.py");
  });
});

describe("outstandingArgv", () => {
  test("runs the script isolated over the session, for its Decide items as JSON", () => {
    expect(outstandingArgv(outstanding, "/home/me", "session-1")).toEqual([
      "python3",
      "-I",
      "/home/me/skills/outstanding.py",
      "--session",
      "session-1",
      "decide",
      "--json",
    ]);
  });

  test("runs the Python the settings name", () => {
    expect(
      outstandingArgv({ ...outstanding, python: "/usr/bin/python3.13" }, "/h", "s")[0],
    ).toBe("/usr/bin/python3.13");
  });
});

describe("missingScript", () => {
  test("finds nothing, and says which path isn't there and how to set it", () => {
    const found = missingScript("/home/me/skills/outstanding.py");
    expect(found.items).toEqual([]);
    expect(found.problem).toMatch(/^\/home\/me\/skills\/outstanding\.py isn't there; set outstanding\.script/);
  });
});

describe("failedRun", () => {
  test("finds nothing, and gives the error as the problem", () => {
    expect(failedRun(new Error("timed out"))).toEqual({
      items: [],
      problem: "Error: timed out",
    });
  });
});

describe("foundFrom", () => {
  test("a clean run gives its items, each with its reference", () => {
    const found = foundFrom(ran(0, JSON.stringify({ items: [item] })));
    expect(found.problem).toBe("");
    expect(found.items.map((i) => i.ref)).toEqual(["abcd1234.Decide.1"]);
  });

  test("a clean run that prints nothing finds nothing, and nothing wrong", () => {
    expect(foundFrom(ran(0, ""))).toEqual(NOTHING);
  });

  test("a clean run drops what isn't an item", () => {
    expect(foundFrom(ran(0, JSON.stringify({ items: [{ turn: 1 }] }))).items).toEqual([]);
  });

  test("a non-zero exit gives stderr's last line as the problem", () => {
    expect(foundFrom(ran(2, "", "Traceback:\n  ...\nValueError: no session\n"))).toEqual({
      items: [],
      problem: "ValueError: no session",
    });
  });

  test("a non-zero exit ignores stdout", () => {
    expect(foundFrom(ran(1, JSON.stringify({ items: [item] }), "broke")).items).toEqual([]);
  });

  test("a non-zero exit with nothing on stderr still says the script failed", () => {
    expect(foundFrom(ran(1, "", "  \n")).problem).toBe("outstanding.py failed");
  });

  test("unparsable stdout finds nothing, and says so", () => {
    const found = foundFrom(ran(0, "not json"));
    expect(found.items).toEqual([]);
    expect(found.problem).toMatch(/^outstanding\.py printed no JSON: /);
  });
});

describe("withProblems", () => {
  test("puts the settings' problems before the run's, in one line", () => {
    expect(
      withProblems(["bad key"], { items: [], problem: "script missing" }).problem,
    ).toBe("bad key; script missing");
  });

  test("keeps the run's items", () => {
    const found = foundFrom(ran(0, JSON.stringify({ items: [item] })));
    expect(withProblems([], found).items).toBe(found.items);
  });

  test("leaves out empty problems", () => {
    expect(withProblems(["", "bad key"], NOTHING).problem).toBe("bad key");
  });

  test("is empty when nothing is wrong", () => {
    expect(withProblems([], NOTHING)).toEqual(NOTHING);
  });
});
