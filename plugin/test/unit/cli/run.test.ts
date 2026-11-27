import { describe, test } from "node:test";
import { expect } from "expect";
import { readFileSync } from "node:fs";

import {
  COMMANDS,
  EXIT,
  USAGE,
  answer,
  finalResponse,
  leftText,
  refused,
  requestOf,
  turnsOf,
  usageRefusal,
} from "../../../cli/run.ts";
import type { Inputs, Request } from "../../../cli/run.ts";
import { DEFAULTS_FILE, loaded } from "../../../src/config/config.ts";
import {
  CLEAN_REPLY_TEXT,
  UNSHAPED_REPLY_TEXT,
  draftLintText,
  lintReply,
  replyLintText,
} from "../../../src/lint/reply.ts";
import {
  apiError,
  assistant,
  human,
  interrupted,
  jsonl,
  stoppedFor,
  toolResult,
} from "../../fixtures/records.ts";
import { pluginFile } from "../../fixtures/cli.ts";
import type { Turn } from "../../../types/index.d.ts";

const DEFAULTS = readFileSync(pluginFile(DEFAULTS_FILE), "utf8");
const SETTINGS = loaded({ path: DEFAULTS_FILE, text: DEFAULTS }, undefined);

/** A request that the arguments ask for, failing the test where they can't be read. */
const requested = (argv: readonly string[]): Request => {
  const request = requestOf(argv);

  if ("problems" in request) {
    throw new Error(request.problems.join("\n"));
  }

  return request.value;
};

const inputs = (turns: string | undefined, draft?: string): Inputs => ({
  turns,
  draft,
  settings: SETTINGS,
  now: Date.UTC(2026, 10, 16, 21),
});

const turn = (id: string, replies: readonly string[]): Turn => ({
  id,
  prompt: { owner: "user", text: "Go on.", reportNames: undefined },
  replies,
  decide: [],
  messages: [],
});

// A reply with a Pending item on each of 25 turns, so the default window,
// the settings' 20 turns, reads fewer than every turn.
const PENDING = (n: number) => `🚧 **Pending:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **Item ${n}**\n`;
const MANY: readonly Turn[] = Array.from({ length: 25 }, (_, n) =>
  turn(`${n}`.padStart(8, "a"), [PENDING(n)]),
);

const BROKEN = "✅ **Done:**  \n▔▔▔▔▔▔▔▔\n1. **A**\n   b\n";
const CLEAN = "✅ **Done:**  \n▔▔▔▔▔▔▔▔\n1. **A**\n";

describe("requestOf", () => {
  test("reads a command with its turns from stdin, the settings left to say the window and width", () => {
    expect(requestOf(["count"])).toEqual({
      value: {
        help: false,
        command: "count",
        source: { from: "stdin" },
        draft: undefined,
        window: undefined,
        width: undefined,
        merged: [],
        json: false,
      },
    });
  });

  test("reads a transcript as Claude Code's unless --harness names one", () => {
    const request = requested(["rollup", "--transcript", "s.jsonl", "--window", "3", "--width", "0"]);

    expect(request).toMatchObject({
      source: { from: "transcript", path: "s.jsonl", harness: "claude-code" },
      window: 3,
      width: 0,
    });
  });

  test("reads each merged pull request as the core reads one, lowercased, a URL too", () => {
    expect(
      requested([
        "count",
        "--merged",
        "Owner/Repo#7",
        "--merged",
        "https://github.com/o/r/pull/8",
      ]),
    ).toMatchObject({ merged: ["owner/repo#7", "o/r#8"] });
  });

  test("refuses a --merged that names no pull request, or more than one", () => {
    expect(requestOf(["count", "--merged", "#7", "--merged", "o/r#1 o/r#2"])).toEqual({
      problems: [
        `--merged "#7" names no pull request: give one, owner/repo#N or its URL`,
        `--merged "o/r#1 o/r#2" names 2 pull requests: give one, owner/repo#N or its URL`,
      ],
    });
  });

  test("refuses a negative --window or --width", () => {
    expect(requestOf(["rollup", "--window=-1", "--width=-3"])).toEqual({
      problems: [
        `--window takes a whole number, 0 or more, not "-1"`,
        `--width takes a whole number, 0 or more, not "-3"`,
      ],
    });
  });

  test("reads no turns for a lint with a draft", () => {
    expect(requested(["lint", "--draft", "-", "--json"])).toMatchObject({
      command: "lint",
      source: undefined,
      draft: "-",
      json: true,
    });
  });

  test("reads every command it names", () => {
    expect(Object.keys(COMMANDS).map((command) => requested([command]).help)).toEqual(
      Object.keys(COMMANDS).map(() => false),
    );
  });

  test("reads --help whatever else is given", () => {
    expect(requestOf(["--help"])).toEqual({ value: { help: true } });
    expect(requestOf(["bogus", "--help"])).toEqual({ value: { help: true } });
  });

  test("names every problem with the arguments", () => {
    expect(requestOf([])).toEqual({
      problems: ["no command: give one of count, rollup, due, lint, turn-id"],
    });
    expect(
      requestOf(["bogus", "extra", "--window", "x", "--harness", "codex", "--draft", "d", "--json"]),
    ).toEqual({
      problems: [
        'no command "bogus": give one of count, rollup, due, lint, turn-id',
        '"extra" is an argument no command takes',
        '--window takes a whole number, 0 or more, not "x"',
        "--harness names no harness with an adapter here: codex; give one of claude-code",
        "--harness names the harness of a --transcript, and none is given",
        "--draft is lint's alone",
        "--json is lint's alone",
      ],
    });
    expect(requestOf(["lint", "--draft", "d", "--transcript", "t"])).toEqual({
      problems: ["lint reads a --draft or a --transcript's last final response, not both"],
    });
  });

  test("reads the session's own transcript, where a session is named and no --transcript or --stdin is given", () => {
    expect(requestOf(["count"], "s-1")).toMatchObject({
      value: { source: { from: "session", session: "s-1", harness: "claude-code" } },
    });
    expect(requestOf(["count", "--stdin"], "s-1")).toMatchObject({ value: { source: { from: "stdin" } } });
    expect(requestOf(["count", "--transcript", "t.jsonl"], "s-1")).toMatchObject({
      value: { source: { from: "transcript", path: "t.jsonl" } },
    });
    expect(requestOf(["lint", "--draft", "-"], "s-1")).toMatchObject({ value: { source: undefined } });
    expect(requestOf(["count"], "")).toMatchObject({ value: { source: { from: "stdin" } } });
  });

  test("refuses due's options it doesn't read: the window, the width and the merged pull requests", () => {
    expect(requestOf(["due", "--window", "3", "--width", "0", "--merged", "o/r#1"])).toEqual({
      problems: [
        "--window isn't due's: due times every turn",
        "--width isn't due's: due prints no summary",
        "--merged isn't due's: due settles no item",
      ],
    });
  });

  test("refuses --stdin beside a --transcript or a --draft", () => {
    expect(requestOf(["count", "--stdin", "--transcript", "t"])).toEqual({
      problems: ["--stdin and --transcript each name where the turns come from: give one"],
    });
    expect(requestOf(["lint", "--stdin", "--draft", "d"])).toEqual({
      problems: ["lint reads a --draft or the turns' last final response, not both"],
    });
  });

  test("passes on node's own word for an option it doesn't know", () => {
    const request = requestOf(["count", "--wndow", "3"]);

    expect("problems" in request && request.problems[0]).toContain("--wndow");
  });
});

describe("usageRefusal", () => {
  test("writes each problem, naming the CLI, then the usage, to stderr, and exits 2", () => {
    expect(usageRefusal(["one", "two"])).toEqual({
      out: "",
      err: `kanban: one\nkanban: two\n\n${USAGE}\n`,
      code: EXIT.usage,
    });
  });
});

describe("refused", () => {
  test("writes each problem, naming the CLI, to stderr, and exits 2", () => {
    expect(refused(["one"])).toEqual({ out: "", err: "kanban: one\n", code: EXIT.usage });
  });
});

describe("USAGE", () => {
  test("names every exit code", () => {
    expect(Object.values(EXIT).filter((code) => !USAGE.includes(`  ${code}  `))).toEqual([]);
  });
});

describe("turnsOf", () => {
  test("reads stdin as neutral turns", () => {
    expect(turnsOf({ from: "stdin" }, JSON.stringify([turn("0f311c94", ["Done."])]))).toEqual({
      value: [turn("0f311c94", ["Done."])],
    });
  });

  test("reads a transcript through its harness's adapter, and the session's own as Claude Code's", () => {
    const text = jsonl([
      human("0f311c94", "Go on."),
      stoppedFor("end_turn", assistant("Done.")),
      human("1a2b3c4d", "Go on."),
      assistant("Half"),
    ]);
    const times = { promptedAt: "2026-11-16T20:06:00.270Z", answeredAt: "2026-11-16T20:06:30.000Z" };
    const expected = {
      value: [
        { ...turn("0f311c94", ["Done."]), ...times },
        { ...turn("1a2b3c4d", ["Half"]), unanswered: true, ...times },
      ],
    };

    expect(turnsOf({ from: "transcript", path: "s.jsonl", harness: "claude-code" }, text)).toEqual(expected);
    expect(turnsOf({ from: "session", session: "s-1", harness: "claude-code" }, text)).toEqual(expected);
  });
});

describe("leftText", () => {
  test("gives minutes and seconds, the seconds rounded up and in two digits", () => {
    expect(leftText(150_000)).toBe("2m30s");
    expect(leftText(59_001)).toBe("1m00s");
    expect(leftText(5_000)).toBe("0m05s");
    expect(leftText(31 * 60_000)).toBe("31m00s");
  });
});

describe("due", () => {
  const FULL = `🚧 **Pending:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **A**\n\n📌 **Outstanding from previous turns:**  \n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚧 **Pending:**  \n- **B** 🔖 0f311c94₋₁\n`;
  const timed = (id: string, minute: number, reply: string): Turn => ({
    ...turn(id, [reply]),
    promptedAt: new Date(Date.UTC(2026, 10, 16, 20, minute)).toISOString(),
    answeredAt: new Date(Date.UTC(2026, 10, 16, 20, minute, 30)).toISOString(),
  });
  const turns = JSON.stringify([timed("aaaaaaa1", 0, FULL), timed("aaaaaaa2", 1, "Done."), timed("aaaaaaa3", 2, "Done.")]);
  const now = (minute: number): number => Date.UTC(2026, 10, 16, 20, minute);

  test("says counts and the time left, until the interval has passed since the last full roll-up", () => {
    // Turns a minute apart: the interval is 5 minutes from 20:00:30.
    expect(answer(requested(["due"]), { ...inputs(turns), now: now(3) })).toEqual({
      out: "counts 2m30s\n",
      err: "",
      code: EXIT.ok,
    });
  });

  test("says full once it has", () => {
    expect(answer(requested(["due"]), { ...inputs(turns), now: now(6) }).out).toBe("full\n");
  });

  test("says full in a session with no full roll-up yet", () => {
    expect(answer(requested(["due"]), inputs(JSON.stringify([turn("aaaaaaa1", ["Done."])]))).out).toBe("full\n");
  });
});

describe("finalResponse", () => {
  test("is the latest turn's last reply", () => {
    expect(finalResponse([turn("a", ["one"]), turn("b", ["two", "three"])])).toBe("three");
  });

  test("passes over an unanswered turn, its text written on the way", () => {
    expect(finalResponse([turn("a", ["one"]), { ...turn("b", ["on the way"]), unanswered: true }])).toBe(
      "one",
    );
  });

  test("passes over a turn with no reply yet", () => {
    expect(finalResponse([turn("a", ["one"]), turn("b", [])])).toBe("one");
  });

  test("is none before any final response", () => {
    expect(finalResponse([turn("a", [])])).toBeUndefined();
    expect(finalResponse([{ ...turn("a", ["on the way"]), unanswered: true }])).toBeUndefined();
  });
});

describe("answer", () => {
  test("prints the usage for --help", () => {
    expect(answer({ help: true }, inputs(undefined))).toEqual({
      out: `${USAGE}\n`,
      err: "",
      code: EXIT.ok,
    });
  });

  test("count reads the settings' window, which --window overrides", () => {
    const text = JSON.stringify(MANY);

    expect(answer(requested(["count"]), inputs(text)).out).toBe("📌 Outstanding: 🚧 20\n");
    expect(answer(requested(["count", "--window", "0"]), inputs(text)).out).toBe(
      "📌 Outstanding: 🚧 25\n",
    );
  });

  test("count writes nothing when nothing is outstanding", () => {
    expect(answer(requested(["count"]), inputs("[]"))).toEqual({ out: "", err: "", code: EXIT.ok });
  });

  test("rollup cuts summaries to the settings' width, which --width overrides", () => {
    const long = `🚧 **Pending:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **${"word ".repeat(30).trim()}**\n`;
    const text = JSON.stringify([turn("0f311c94", [long])]);

    expect(answer(requested(["rollup"]), inputs(text)).out).toContain("…");
    expect(answer(requested(["rollup", "--width", "0"]), inputs(text)).out).not.toContain("…");
  });

  test("turn-id gives the latest turn's id", () => {
    const text = JSON.stringify([turn("0f311c94", []), turn("1a2b3c4d", [])]);

    expect(answer(requested(["turn-id"]), inputs(text))).toEqual({
      out: "1a2b3c4d\n",
      err: "",
      code: EXIT.ok,
    });
  });

  test("turn-id refuses turns with none", () => {
    expect(answer(requested(["turn-id"]), inputs("[]"))).toEqual({
      out: "",
      err: "kanban: there is no turn, so no turn's id\n",
      code: EXIT.usage,
    });
  });

  test("turn-id refuses a latest turn with an empty id, as a transcript can give one", () => {
    const text = jsonl([human("", "Go on.")]);

    expect(answer(requested(["turn-id", "--transcript", "s.jsonl"]), inputs(text))).toEqual({
      out: "",
      err: "kanban: the latest turn has no id\n",
      code: EXIT.usage,
    });
  });

  test("lint lints a draft as kanban_lint does, exiting 1 on a finding", () => {
    expect(answer(requested(["lint", "--draft", "-"]), inputs(undefined, BROKEN))).toEqual({
      out: `${draftLintText(lintReply(BROKEN))}\n`,
      err: "",
      code: EXIT.findings,
    });
  });

  test("lint lints the last final response in the turn's end's words", () => {
    const text = JSON.stringify([turn("0f311c94", [BROKEN])]);

    expect(answer(requested(["lint"]), inputs(text))).toEqual({
      out: `${replyLintText(lintReply(BROKEN))}\n`,
      err: "",
      code: EXIT.findings,
    });
  });

  test("lint gives the last final response's findings as JSON for --json", () => {
    const text = JSON.stringify([turn("0f311c94", [BROKEN])]);

    expect(answer(requested(["lint", "--json"]), inputs(text))).toEqual({
      out: `${JSON.stringify({ findings: lintReply(BROKEN) })}\n`,
      err: "",
      code: EXIT.findings,
    });
  });

  test("lint passes over an unanswered turn's text written on the way, to the last final response", () => {
    const text = JSON.stringify([
      turn("0f311c94", [CLEAN]),
      { ...turn("1a2b3c4d", [BROKEN]), unanswered: true },
    ]);

    expect(answer(requested(["lint"]), inputs(text))).toEqual({
      out: `${CLEAN_REPLY_TEXT}\n`,
      err: "",
      code: EXIT.ok,
    });
  });

  test("lint passes over the unanswered turns of a Claude Code transcript: running, cut off or ended by an API error", () => {
    for (const unanswered of [
      [stoppedFor("tool_use", assistant(BROKEN))],
      [assistant(BROKEN), interrupted()],
      [stoppedFor("tool_use", assistant(BROKEN)), toolResult(), apiError("API Error: Connection lost mid-response.")],
    ]) {
      const text = jsonl([
        human("0f311c94", "Go on."),
        stoppedFor("end_turn", assistant(CLEAN)),
        human("1a2b3c4d", "Again."),
        ...unanswered,
      ]);

      expect(answer(requested(["lint", "--transcript", "s.jsonl"]), inputs(text)).out).toBe(
        `${CLEAN_REPLY_TEXT}\n`,
      );
    }
  });

  test("lint passes over a final response in no list's shape, as the turn's end does", () => {
    const shapeless = "| a |\n| - |\n| b |\nafter\n";
    const text = JSON.stringify([turn("0f311c94", [shapeless])]);

    expect(lintReply(shapeless)).not.toEqual([]);
    expect(answer(requested(["lint"]), inputs(text))).toEqual({
      out: `${UNSHAPED_REPLY_TEXT}\n`,
      err: "",
      code: EXIT.ok,
    });
  });

  test("lint refuses turns with no final response", () => {
    const unanswered = JSON.stringify([{ ...turn("0f311c94", [BROKEN]), unanswered: true }]);

    expect(answer(requested(["lint"]), inputs("[]")).err).toBe(
      "kanban: there is no final response to lint\n",
    );
    expect(answer(requested(["lint"]), inputs(unanswered)).code).toBe(EXIT.usage);
  });

  test("refuses neutral turns out of shape, saying where", () => {
    expect(answer(requested(["count"]), inputs('[{"id": 1}]'))).toEqual({
      out: "",
      err: "kanban: turns[0].id 1 isn't a turn's id: 8 characters of 0123456789abcdef\nkanban: turns[0].prompt isn't an object\n",
      code: EXIT.usage,
    });
  });

  test("warns of a refused user file, and uses the defaults", () => {
    const settings = loaded(
      { path: DEFAULTS_FILE, text: DEFAULTS },
      { path: "user.yaml", text: "counts:\n  nonsense: 1\n" },
    );
    const result = answer(requested(["count"]), { ...inputs("[]"), settings });

    expect(result.code).toBe(EXIT.ok);
    expect(result.err).toContain("kanban: user.yaml: ");
  });

  test("refuses to run with no defaults to read", () => {
    const settings = loaded({ path: DEFAULTS_FILE, text: undefined }, undefined);
    const result = answer(requested(["count"]), { ...inputs("[]"), settings });

    expect(result.code).toBe(EXIT.usage);
    expect(result.err).toContain("the plugin's defaults can't be read");
  });
});
