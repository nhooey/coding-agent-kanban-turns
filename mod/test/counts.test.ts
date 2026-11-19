// The line the band folds to: the skill's count line, else the open Decide
// items counted.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  countsArgv,
  countsOf,
  foldedLine,
  openDecisions,
} from "../src/counts.ts";

const LINE = "📌 Outstanding: 🚧 2 · 🤔 2 · 🔍 2 · 👉 2 · 🧠 3";

describe("the count line", () => {
  test("is printed by outstanding.py render --counts over this session", () => {
    expect(countsArgv("python3", "/s/outstanding.py", "session-1")).toEqual([
      "python3",
      "-I",
      "/s/outstanding.py",
      "--session",
      "session-1",
      "render",
      "--counts",
    ]);
  });

  test("is the run's first line that isn't blank, trimmed", () => {
    expect(countsOf({ exitCode: 0, stdout: `${LINE}\n` })).toBe(LINE);
    expect(countsOf({ exitCode: 0, stdout: `\n  ${LINE}  \nmore\n` })).toBe(LINE);
  });

  test("is empty when the run prints nothing or fails", () => {
    expect(countsOf({ exitCode: 0, stdout: "\n" })).toBe("");
    expect(countsOf({ exitCode: 2, stdout: LINE })).toBe("");
  });
});

describe("the folded line", () => {
  test("is the count line when there is one", () => {
    expect(foldedLine(LINE, 3)).toBe(LINE);
    expect(foldedLine(LINE, 0)).toBe(LINE);
  });

  test("counts the open Decide items when there is none", () => {
    expect(foldedLine("", 3)).toBe("🧠 3 open decisions");
    expect(foldedLine("", 0)).toBe("");
  });

  test("names one decision in the singular", () => {
    expect(openDecisions(1)).toBe("🧠 1 open decision");
    expect(openDecisions(0)).toBe("");
  });
});
