// The reports that settle a Waiting item, read out of a turn's prompt.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  elements,
  namesWord,
  reportNames,
  reportNamesItem,
} from "../src/reports.ts";

describe("elements", () => {
  test("each element with its attributes and its own text, no child's", () => {
    expect(
      elements('<task-notification>\n<task-id>b8</task-id>\n<summary>A "x" ran</summary>\n</task-notification>'),
    ).toEqual([
      { tag: "task-notification", attrs: {}, text: "" },
      { tag: "task-id", attrs: {}, text: "b8" },
      { tag: "summary", attrs: {}, text: 'A "x" ran' },
    ]);
  });

  test("attribute names lowercased, values unquoted and unescaped", () => {
    expect(elements("<A From='x &amp; y' bare=z>t</A>")).toEqual([
      { tag: "a", attrs: { from: "x & y", bare: "z" }, text: "t" },
    ]);
  });

  test("nested elements keep their own text apart, an unclosed one closed by its parent", () => {
    expect(elements("<a>1<b>2<c>3</b>4</a>5<d/>")).toEqual([
      { tag: "a", attrs: {}, text: "14" },
      { tag: "b", attrs: {}, text: "2" },
      { tag: "c", attrs: {}, text: "3" },
      { tag: "d", attrs: {}, text: "" },
    ]);
    expect(elements("</x>text<y>")).toEqual([{ tag: "y", attrs: {}, text: "" }]);
  });

  test("a text of many tags parses in time linear in them", () => {
    const count = 50_000;
    const started = performance.now();
    const found = elements(`<task-notification>${"<summary>x</summary>".repeat(count)}</task-notification>`);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(found).toHaveLength(count + 1);
    expect(found.at(-1)).toEqual({ tag: "summary", attrs: {}, text: "x" });
  });

  test("a bare `&` or `<` is text", () => {
    expect(elements("<summary>a < b & c &lt; d</summary>")).toEqual([
      { tag: "summary", attrs: {}, text: "a < b & c < d" },
    ]);
  });
});

describe("reportNames", () => {
  test("another session's message goes by the session's name", () => {
    expect(
      reportNames('<cross-session-message from="uds:/x" from-name="github-config">\nDone.\n</cross-session-message>'),
    ).toEqual(["github-config"]);
  });

  test("an agent's message goes by the agent's id", () => {
    expect(reportNames('<agent-message from="a48bb">\nPushed.\n</agent-message>')).toEqual(["a48bb"]);
  });

  test("a finished task goes by its id and the names its summary quotes", () => {
    for (const status of ["completed", "failed", "killed", "stopped", "cancelled", "Completed"]) {
      expect(
        reportNames(
          `<task-notification>\n<task-id>b8</task-id>\n<status>${status}</status>\n<summary>Agent "x" and "y" ${status}</summary>\n</task-notification>`,
        ),
      ).toEqual(["b8", "x", "y"]);
    }
  });

  test("an expired Monitor is a report", () => {
    expect(
      reportNames(
        "<task-notification>\n<task-id>b8</task-id>\n<event>[Monitor expired after 1h]</event>\n</task-notification>",
      ),
    ).toEqual(["b8"]);
  });

  test("a task still running, a Monitor's event, or plain text is no report", () => {
    for (const prompt of [
      '<task-notification>\n<task-id>b8</task-id>\n<status>completed</status>\n<summary>Agent "x" is waiting on its own background work</summary>\n</task-notification>',
      "<task-notification>\n<task-id>b8</task-id>\n<event>CHECK ok</event>\n</task-notification>",
      "<task-notification>\n<task-id>b8</task-id>\n<status>running</status>\n</task-notification>",
      "go on",
    ]) {
      expect(reportNames(prompt)).toBeUndefined();
    }
  });
});

describe("reportNamesItem", () => {
  test("the item's summary holds one of the report's names, as a whole word", () => {
    expect(reportNamesItem("Watcher (`b8a83gfv0`)", ["b8a83gfv0"], "")).toBe(true);
    expect(reportNamesItem("GitHub-Config: the fixes", ["github-config"], "")).toBe(true);
    expect(reportNamesItem("github-config-2: the fixes", ["github-config"], "")).toBe(false);
    expect(reportNamesItem("Watcher", ["watch"], "")).toBe(false);
  });

  test("the report holds a branch-shaped code span of the summary", () => {
    expect(
      reportNamesItem("The implementer, on `outstanding-settled-items`", [], "Pushed outstanding-settled-items."),
    ).toBe(true);
    expect(reportNamesItem("The README, `README.md`", [], "README.md done")).toBe(false);
  });

  test("an empty name names nothing", () => {
    expect(namesWord("  ", "anything")).toBe(false);
  });
});
