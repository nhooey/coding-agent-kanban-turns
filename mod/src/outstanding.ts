// Running `outstanding.py decide --json` over this session's transcript, as
// the `outstanding` settings say: the script's path and argv going in, the
// open items or why there are none coming out. The hooks hold the one effect
// between them, checking the script is there and running it.

import { expandHome, parseJsonc } from "./config.ts";
import { itemsOf } from "./items.ts";
import type { DecideItem, Settings } from "../types/index.d.ts";

/** The open items, or why there are none. */
export type Found = Readonly<{ items: readonly DecideItem[]; problem: string }>;

/** What one run of the script gave back. */
export type Ran = Readonly<{ exitCode: number; stdout: string; stderr: string }>;

/** No items and nothing wrong: what a run with no settings finds. */
export const NOTHING: Found = { items: [], problem: "" };

// What a run prints when it finds nothing to say.
const NO_ITEMS = '{"items": []}';

/** The script's path, with a leading `~/` read as `home`. */
export const scriptPath = (
  outstanding: Settings["outstanding"],
  home: string | undefined,
): string => expandHome(outstanding.script, home);

/** The command that lists this session's open Decide items. */
export const outstandingArgv = (
  outstanding: Settings["outstanding"],
  home: string | undefined,
  sessionId: string,
): readonly string[] => [
  outstanding.python,
  "-I",
  scriptPath(outstanding, home),
  "--session",
  sessionId,
  "decide",
  "--json",
];

/** Nothing found, because the script isn't at `script`. */
export const missingScript = (script: string): Found => ({
  items: [],
  problem: `${script} isn't there; set outstanding.script in your config.jsonc (/answers-config shows it)`,
});

/** Nothing found, because running the script threw. */
export const failedRun = (error: unknown): Found => ({
  items: [],
  problem: String(error),
});

/** A run's open items, or why there are none: its last stderr line on failure, or the parse error. */
export const foundFrom = ({ exitCode, stdout, stderr }: Ran): Found => {
  const parsed = parseJsonc(stdout || NO_ITEMS);

  return exitCode !== 0
    ? {
        items: [],
        problem: stderr.trim().split("\n").at(-1) || "outstanding.py failed",
      }
    : "value" in parsed
      ? { items: itemsOf(parsed.value), problem: "" }
      : { items: [], problem: `outstanding.py printed no JSON: ${parsed.error}` };
};

/** The run's items, with the settings' problems before the run's own in one line. */
export const withProblems = (
  problems: readonly string[],
  found: Found,
): Found => ({
  items: found.items,
  problem: [...problems, found.problem].filter((p) => p !== "").join("; "),
});
