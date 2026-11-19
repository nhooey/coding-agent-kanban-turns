// The line above the prompt: the skill's count line.

import { describe, test } from "node:test";
import { expect } from "expect";

import { countsArgv, countsOf } from "../src/counts.ts";

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
