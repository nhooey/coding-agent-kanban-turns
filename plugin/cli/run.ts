// The kanban CLI's commands, each a thin edge over the function of the core
// the plugin's own tools and hooks call: `count`, the count line
// (countLine); `rollup`, the full 📌 roll-up (rollUpDraft); `due`, whether
// the full roll-up is due by the roll-up interval (rollUpDue); `lint`, a
// reply's findings (lintReply, with kanban_lint's text for a draft and the
// turn's end's for the last final response); and `turn-id`, the current
// turn's id, the latest turn's. No I/O: cli/kanban.ts reads the arguments,
// the session, the clock, the files and stdin, hands them here, and writes
// out what comes back.
//
// The turns come from a transcript, read through the adapter of the harness
// that wrote it, Claude Code's unless `--harness` names another; else, in a
// Claude Code session, from the session's own transcript, which the edge
// finds; else, or for `--stdin`, from stdin, as a JSON list of neutral turns
// (cli/neutral.ts), for a harness with no adapter here. The window, the
// summary width and the merged pull requests come from the plugin's
// settings, which `--window`, `--width` and `--merged` override; the CLI
// asks GitHub nothing.

import { parseArgs } from "node:util";

import { countLine, pullRequestsOf } from "../src/items/outstanding.ts";
import { rollUpDue } from "../src/items/roll-up-due.ts";
import type { Due } from "../src/items/roll-up-due.ts";
import { rollUpDraft } from "../src/items/roll-up.ts";
import {
  CLEAN_REPLY_TEXT,
  UNSHAPED_REPLY_TEXT,
  draftLintText,
  isKanbanReply,
  lintReply,
  replyLintText,
} from "../src/lint/reply.ts";
import { SPEC } from "../src/protocol/spec.ts";
import { turnsOfText } from "../src/transcript/claude-code.ts";
import type { Loaded, Turn } from "../types/index.d.ts";
import { turnsOfJson } from "./neutral.ts";
import type { Got } from "./neutral.ts";

/** The CLI's name, as its usage writes it. */
export const NAME = "kanban";

/** Each harness with an adapter here, by the name `--harness` takes, and what reads its transcript's text into turns. */
export const ADAPTERS: Readonly<Record<string, (text: string) => readonly Turn[]>> = {
  "claude-code": turnsOfText,
};

/** The harness a transcript is read as when `--harness` names none. */
export const DEFAULT_HARNESS = "claude-code";

const ROLL_UP = SPEC["roll-up"];

/** What each command gives. */
export const COMMANDS = {
  count: `the ${ROLL_UP.glyph} count line, empty when nothing is outstanding`,
  rollup: `the full ${ROLL_UP.glyph} roll-up, each item ending in its ${SPEC.tag.glyph} tag, empty when nothing is outstanding`,
  due: `whether the full ${ROLL_UP.glyph} roll-up is due by the roll-up interval: full, or counts and the time until it is`,
  lint: "the reply lint's findings for a draft (--draft) or the last final response, exiting 1 when there are any",
  "turn-id": "the current turn's id, the latest turn's",
} as const;

export type Command = keyof typeof COMMANDS;

/**
 * Where the turns come from: stdin, as neutral turns; a transcript's path
 * and the harness that wrote it; or a Claude Code session's own
 * transcript, by the session's id, which the edge finds.
 */
export type Source = Readonly<
  | { from: "stdin" }
  | { from: "transcript"; path: string; harness: string }
  | { from: "session"; session: string; harness: string }
>;

/** What the arguments ask for. A `lint` with a draft reads no turns, so its `source` is none. */
export type Request = Readonly<
  | { help: true }
  | {
      help: false;
      command: Command;
      source: Source | undefined;
      draft: string | undefined;
      window: number | undefined;
      width: number | undefined;
      merged: readonly string[];
      json: boolean;
    }
>;

/** What a command gives back: what it writes to stdout and to stderr, and its exit code. */
export type Result = Readonly<{ out: string; err: string; code: number }>;

/** The exit codes: all well, lint findings, and arguments, input or settings that can't be used. */
export const EXIT = { ok: 0, findings: 1, usage: 2 } as const;

const HARNESSES = Object.keys(ADAPTERS).join(", ");

/** The variable Claude Code names its session by, whose transcript the turns are read from by default. */
export const SESSION_VARIABLE = "CLAUDE_CODE_SESSION_ID";

/** The CLI's usage, as `--help` prints it and a bad argument follows. */
export const USAGE = [
  `Usage: ${NAME} <command> [--transcript <path> [--harness <name>]] [options]`,
  "",
  "Commands:",
  ...Object.entries(COMMANDS).map(([command, gives]) => `  ${command.padEnd(9)} ${gives}`),
  "",
  "The turns are read from the transcript at --transcript, as the harness --harness names",
  `writes it (${HARNESSES}; ${DEFAULT_HARNESS} unless named); else, where ${SESSION_VARIABLE}`,
  "names a Claude Code session, from its transcript in the projects/ folder of CLAUDE_CONFIG_DIR",
  "or ~/.claude/, in the working directory's project folder or the one that holds it; else, or",
  "for --stdin, from stdin, as a JSON list of neutral turns. A child process inherits the",
  `session's ${SESSION_VARIABLE}, so another harness passes --stdin or --transcript always.`,
  "A turn's unanswered, true where it has no final response, keeps lint off its replies; its",
  "promptedAt and answeredAt, ISO 8601 times, time due.",
  "",
  "Options:",
  "  --transcript <path>  a session's transcript",
  `  --harness <name>     the harness that wrote it: ${HARNESSES}`,
  "  --stdin              read the turns from stdin, even in a Claude Code session",
  "  --window <n>         how many of the latest turns to read; 0 reads every turn since the latest reassess",
  "  --width <n>          how long a roll-up item's summary may be; 0 keeps summaries whole",
  "  --merged <pr>        a pull request known merged, owner/repo#N or its URL; once per pull request",
  "  --draft <path>       lint: the draft to lint, - for stdin, in place of the last final response",
  "  --json               lint: the findings as JSON, {\"findings\": [{\"line\", \"rule\", \"detail\"}]}",
  "  --help               this usage",
  "",
  "The window and the width default to the plugin's settings, its defaults/config.yaml with",
  "the user's own config.yaml merged over it.",
  "",
  "Exit codes:",
  `  ${EXIT.ok}  done`,
  `  ${EXIT.findings}  lint found something`,
  `  ${EXIT.usage}  the arguments, the input or the settings can't be used, as stderr says`,
].join("\n");

const OPTIONS = {
  transcript: { type: "string" },
  harness: { type: "string" },
  stdin: { type: "boolean" },
  window: { type: "string" },
  width: { type: "string" },
  merged: { type: "string", multiple: true },
  draft: { type: "string" },
  json: { type: "boolean" },
  help: { type: "boolean" },
} as const;

const isCommand = (word: string): word is Command => Object.hasOwn(COMMANDS, word);

/** A whole number, 0 or more, an option gives, or a problem naming the option. */
const numberOf = (option: string, text: string | undefined): Got<number | undefined> =>
  text === undefined
    ? { value: undefined }
    : /^\d+$/.test(text)
      ? { value: Number(text) }
      : { problems: [`--${option} takes a whole number, 0 or more, not ${JSON.stringify(text)}`] };

/** The pull request each `--merged` names, read as the core reads one in a Review item, or a problem for each that names none, or more than one. */
const mergedOf = (values: readonly string[]): Got<readonly string[]> => {
  const read = values.map((value) => ({ value, found: pullRequestsOf(value) }));
  const problems = read
    .filter(({ found }) => found.length !== 1)
    .map(
      ({ value, found }) =>
        `--merged ${JSON.stringify(value)} names ${found.length === 0 ? "no pull request" : `${found.length} pull requests`}: give one, owner/repo#N or its URL`,
    );

  return problems.length > 0 ? { problems } : { value: read.flatMap(({ found }) => found) };
};

/** The arguments' values, or why they can't be read, as node's parseArgs says. */
const parsed = (argv: readonly string[]) => {
  try {
    return parseArgs({ args: [...argv], options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

/** Where the turns come from: a --transcript, else --stdin, else the Claude Code session named, else stdin. */
const sourceOf = (
  transcript: string | undefined,
  stdin: boolean,
  session: string | undefined,
  harness: string,
): Source =>
  transcript !== undefined
    ? { from: "transcript", path: transcript, harness }
    : !stdin && session !== undefined && session !== ""
      ? { from: "session", session, harness: DEFAULT_HARNESS }
      : { from: "stdin" };

/** What the arguments ask for, in the Claude Code session `session` names, where one does, or every problem with them. */
export const requestOf = (argv: readonly string[], session?: string): Got<Request> => {
  const args = parsed(argv);

  if (typeof args === "string") {
    return { problems: [args] };
  }
  const { values, positionals } = args;
  const [word, ...rest] = positionals;
  const window = numberOf("window", values.window);
  const width = numberOf("width", values.width);
  const merged = mergedOf(values.merged ?? []);
  const harness = values.harness ?? DEFAULT_HARNESS;
  const command = word !== undefined && isCommand(word) ? word : undefined;
  const isDrafted = command === "lint" && values.draft !== undefined;
  const commands = Object.keys(COMMANDS).join(", ");
  const problems = [
    ...(word === undefined
      ? [`no command: give one of ${commands}`]
      : command === undefined
        ? [`no command ${JSON.stringify(word)}: give one of ${commands}`]
        : []),
    ...rest.map((extra) => `${JSON.stringify(extra)} is an argument no command takes`),
    ...("problems" in window ? window.problems : []),
    ...("problems" in width ? width.problems : []),
    ...("problems" in merged ? merged.problems : []),
    ...(Object.hasOwn(ADAPTERS, harness)
      ? []
      : [`--harness names no harness with an adapter here: ${harness}; give one of ${HARNESSES}`]),
    ...(values.harness !== undefined && values.transcript === undefined
      ? ["--harness names the harness of a --transcript, and none is given"]
      : []),
    ...(values.draft !== undefined && command !== "lint" ? ["--draft is lint's alone"] : []),
    ...(values.json === true && command !== "lint" ? ["--json is lint's alone"] : []),
    ...(command === "due" && values.window !== undefined
      ? ["--window isn't due's: due times every turn"]
      : []),
    ...(command === "due" && values.width !== undefined
      ? ["--width isn't due's: due prints no summary"]
      : []),
    ...(command === "due" && values.merged !== undefined
      ? ["--merged isn't due's: due settles no item"]
      : []),
    ...(isDrafted && values.transcript !== undefined
      ? ["lint reads a --draft or a --transcript's last final response, not both"]
      : []),
    ...(values.stdin === true && values.transcript !== undefined
      ? ["--stdin and --transcript each name where the turns come from: give one"]
      : []),
    ...(isDrafted && values.stdin === true
      ? ["lint reads a --draft or the turns' last final response, not both"]
      : []),
  ];

  return values.help === true
    ? { value: { help: true } }
    : problems.length > 0 ||
        command === undefined ||
        !("value" in window) ||
        !("value" in width) ||
        !("value" in merged)
      ? { problems }
      : {
          value: {
            help: false,
            command,
            source: isDrafted
              ? undefined
              : sourceOf(values.transcript, values.stdin === true, session, harness),
            draft: values.draft,
            window: window.value,
            width: width.value,
            merged: merged.value,
            json: values.json === true,
          },
        };
};

/** Each problem as a line of stderr, naming the CLI. */
const problemLines = (problems: readonly string[]): string =>
  problems.map((problem) => `${NAME}: ${problem}\n`).join("");

/** The result for arguments that can't be read: each problem, then the usage, on stderr, and the usage exit code. */
export const usageRefusal = (problems: readonly string[]): Result => ({
  out: "",
  err: `${problemLines(problems)}\n${USAGE}\n`,
  code: EXIT.usage,
});

/** What the edge read for a request: the turns' text, from its source; the draft's, for a `lint --draft`; the settings in effect; and the time, in milliseconds, that `due` reckons from. */
export type Inputs = Readonly<{
  turns: string | undefined;
  draft: string | undefined;
  settings: Loaded;
  now: number;
}>;

/** A result with nothing on stdout, the problems on stderr and the usage exit code. */
export const refused = (problems: readonly string[]): Result => ({
  out: "",
  err: problemLines(problems),
  code: EXIT.usage,
});

/** A result that writes `text`, a line, to stdout, or nothing for empty text. */
const said = (text: string, code: number = EXIT.ok): Result => ({
  out: text === "" ? "" : `${text}\n`,
  err: "",
  code,
});

/** The turns of a source's text: a transcript's, the session's own among them, through its harness's adapter, stdin's as neutral turns. */
export const turnsOf = (source: Source, text: string): Got<readonly Turn[]> =>
  source.from === "stdin"
    ? turnsOfJson(text)
    : { value: (ADAPTERS[source.harness] ?? turnsOfText)(text) };

const SECOND = 1000;

/** A time left, in milliseconds, as minutes and seconds, the seconds rounded up and in two digits: `2m30s`. */
export const leftText = (left: number): string => {
  const seconds = Math.ceil(left / SECOND);

  return `${Math.floor(seconds / 60)}m${String(seconds % 60).padStart(2, "0")}s`;
};

/** `due`'s answer: `full`, or `counts` and the time until the full roll-up is due. */
const dueText = (due: Due): string => (due.full ? "full" : `counts ${leftText(due.left)}`);

/** `lint`'s result for a draft, as kanban_lint gives it. */
const draftResult = (text: string, json: boolean): Result => {
  const findings = lintReply(text);

  return said(
    json ? JSON.stringify({ findings }) : draftLintText(findings),
    findings.length === 0 ? EXIT.ok : EXIT.findings,
  );
};

/**
 * `lint`'s result for the last final response, as the turn's end gives it:
 * a reply in no list's shape passed over, as the turn's end passes it, and
 * the findings in the turn's end's words, or that there are none.
 */
const replyResult = (text: string, json: boolean): Result => {
  const findings = isKanbanReply(text) ? lintReply(text) : [];

  return said(
    json
      ? JSON.stringify({ findings })
      : !isKanbanReply(text)
        ? UNSHAPED_REPLY_TEXT
        : findings.length === 0
          ? CLEAN_REPLY_TEXT
          : replyLintText(findings),
    findings.length === 0 ? EXIT.ok : EXIT.findings,
  );
};

/**
 * The last final response among the turns, the reply the turn's end last
 * linted: the last reply of the latest turn with a final response and a
 * reply, as an unanswered turn's replies are text written on the way; none
 * before any.
 */
export const finalResponse = (turns: readonly Turn[]): string | undefined =>
  turns.findLast((turn) => turn.unanswered !== true && turn.replies.length > 0)?.replies.at(-1);

/** What a command gives for turns read, over the window and with the width and merges in effect. */
const commandResult = (
  command: Command,
  turns: readonly Turn[],
  over: Readonly<{ window: number; width: number; merged: ReadonlySet<string>; json: boolean; now: number }>,
): Result => {
  const reply = command === "lint" ? finalResponse(turns) : undefined;
  const id = turns.at(-1)?.id;

  return command === "count"
    ? said(countLine(turns, over.window, over.merged))
    : command === "rollup"
      ? said(rollUpDraft(turns, over.window, over.merged, over.width))
      : command === "due"
        ? said(dueText(rollUpDue(turns, over.now)))
      : command === "turn-id"
        ? id === undefined || id === ""
          ? refused([
              id === undefined
                ? "there is no turn, so no turn's id"
                : "the latest turn has no id",
            ])
          : said(id)
        : reply === undefined
          ? refused(["there is no final response to lint"])
          : replyResult(reply, over.json);
};

/** What the CLI gives for a request and what the edge read for it. */
export const answer = (request: Request, inputs: Inputs): Result => {
  const { settings, problems } = inputs.settings;
  const withWarnings = (result: Result): Result => ({
    ...result,
    err: `${problemLines(problems)}${result.err}`,
  });

  if (request.help) {
    return said(USAGE);
  }
  if (settings === null) {
    return withWarnings(refused(["the plugin's defaults can't be read, so no settings are in effect"]));
  }
  const over = {
    window: request.window ?? settings.counts.turns,
    width: request.width ?? settings["roll-up"]["summary-width"],
    merged: new Set(request.merged),
    json: request.json,
    now: inputs.now,
  };

  if (request.source === undefined) {
    return withWarnings(draftResult(inputs.draft ?? "", request.json));
  }
  const turns = turnsOf(request.source, inputs.turns ?? "");

  return withWarnings(
    "problems" in turns
      ? refused(turns.problems)
      : commandResult(request.command, turns.value, over),
  );
};
