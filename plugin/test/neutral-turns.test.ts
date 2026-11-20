// The Claude Code adapter and the core reading its neutral turns give what
// the oracle gives, which reads the JSONL records straight into turns that
// are the user's own or not: over random record sequences, after each
// record, the turns and everything the core reads from them.
//
// One difference is deliberate. A prompt a plugin sent as the user, an
// `origin` of kind `plugin` and no `pluginPrompt`, as this plugin's Submit
// and Reassess send theirs, opens a turn for the adapter and none for the
// oracle, which folded it into the turn before. The oracle is handed such a
// record in the `pluginPrompt` shape it reads, so the rest compares as is.

import { describe, test } from "node:test";
import { expect } from "expect";

import { turnsOf } from "../src/claude-code-transcript.ts";
import type { TranscriptRecord } from "../src/claude-code-transcript.ts";
import { PLUGIN } from "../src/instructions.ts";
import { itemsOf } from "../src/items.ts";
import * as core from "../src/outstanding.ts";
import { isOwn, reassessStart } from "../src/transcript.ts";
import type { Turn } from "../types/index.d.ts";
import * as oracle from "./oracle/outstanding.ts";
import * as oracleTranscript from "./oracle/transcript.ts";
import {
  assistant,
  commandOutput,
  compactSummary,
  engineRow,
  human,
  notification,
  otherPluginPrompt,
  peer,
  pluginPrompt,
  pluginRow,
  queued,
  sdkPrompt,
  skillBody,
  submitted,
  toolResult,
} from "./records.ts";

const SEQUENCES = 400;
const LONGEST = 24;
const SEED = 0x6b616e62;
const WINDOWS = [0, 1, 3, 20] as const;
const MERGED: readonly ReadonlySet<string>[] = [
  new Set(),
  new Set(["nhooey/kanban#21"]),
  new Set(["nhooey/kanban#21", "nhooey/kanban#22"]),
];

/** mulberry32's output step: a 32-bit state mixed to an unsigned 32-bit number. */
const mix = (state: number): number => {
  const a = Math.imul(state ^ (state >>> 15), 1 | state);
  const b = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a;

  return (b ^ (b >>> 14)) >>> 0;
};

/** Where a draw is made: the sequence, the record and the choice within it, so each draw is its own number. */
type At = readonly number[];

/** A number in [0, 1) for a place, the same every run under SEED. */
const unit = (at: At): number =>
  at.reduce(
    (hash, key) => mix((hash + 0x6d2b79f5 + Math.imul(key + 1, 0x9e3779b1)) | 0),
    SEED,
  ) / 4294967296;

/** A whole number below `n`, drawn at `at`. */
const below = (at: At, n: number): number => Math.floor(unit(at) * n);

/** One of `choices`, drawn at `at`. */
const pick = <T>(at: At, choices: readonly T[]): T =>
  choices[below(at, choices.length)] as T;

const IDS = ["9efb08a1", "b2c3d4e5", "c3d4e5f6", "d4e5f6a7", ""] as const;

const SUMMARIES = [
  "Which cache to keep for the loader",
  "Backlog cleanups to start",
  "Ship the release tonight?",
] as const;

const DECIDE_REPLY = `Prose.

🧠 **Decide:**
▔▔▔▔▔▔▔▔▔▔
1. **${SUMMARIES[0]}**
   🔘 A. **Disk**: x.
   🔘 B. **Memory**: y.
   ⠀
2. **${SUMMARIES[1]}**
   🔲 A. **Entry 1411**: one.
   🔲 B. **Dead code**: two.
   ⠀
3. **${SUMMARIES[2]}**
   🔘 A. **Ship it**: out.
   🔘 B. **Hold it**: waits.
`;

const waiting = (summary: string) =>
  `⏳ **Waiting:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **${summary}**\n`;

const REPLIES = [
  DECIDE_REPLY,
  "Prose only.",
  "   ",
  "🚧 **Pending:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **Rework the loader** It reads twice.\n",
  waiting("Watcher (`b8a83gfv0`)"),
  waiting("The implementer, on branch `outstanding-settled-items`"),
  waiting("github-config: the two fixes"),
  "🔍 **Review:**  \n1. **🔗 [#21 Close](https://github.com/nhooey/kanban/pull/21)**\n2. **nhooey/kanban#22 Bump**\n3. **#23 The README**\n",
  "🔑 **Authorizations:**  \n1. **The `v2.4.0` tag's SSH signature**\n\n👉 **Todo:**  \n1. **Paste the prompt**\n",
  `Prose.\n\n📌 **Outstanding from previous turns:**  \n${"━".repeat(35)}\n🧠 **Decide:**  \n- **${SUMMARIES[0]}** 🔖 9efb08a1₋₁\n⏳ **Waiting:**  \n- **Watcher (\`b8a83gfv0\`)** 🔖 9efb08a1₋₂\n`,
] as const;

const TASK_DONE =
  "<task-notification>\n<task-id>b8a83gfv0</task-id>\n<status>completed</status>\n<summary>done</summary>\n</task-notification>";

const PROMPTS = [
  "go",
  "more",
  "1. A",
  "1. A / 3. Y",
  "Decide.1: B",
  "2. B",
  "9efb08a1.Decide.2.B",
  "9efb08a1.Decide.1: not yet",
  "b2c3d4e5.Decide.1.A",
  "Decide.3.B of 9efb08a1",
  "1. B? how would B work",
  "reassess",
  "recheck",
  "restate",
  "go\nreassess",
  "1. A / 3. Y\nreassess",
  "coding-agent-kanban-turns:\n9efb08a1.Decide.1.A\nreassess\n",
  "coding-agent-kanban-turns:\n2. B",
  "/coding-agent-kanban-turn-responses recheck",
  TASK_DONE,
  '<agent-message from="a48bb">\n  Pushed branch outstanding-settled-items at 1234abc.\n</agent-message>',
  '<cross-session-message from="uds:/tmp/x.sock" from-name="github-config" from-mode="prompting">\nDone.\n</cross-session-message>',
] as const;

/** A kanban_options call raising some of the Decide reply's items, under a turn id, drawn at `at`. */
const call = (at: At): unknown => {
  const turn = pick([...at, 0], IDS.slice(0, 3));
  const numbers = [1, 2, 3].filter((number) => below([...at, number], 3) > 0);

  return {
    items: numbers.map((number) => ({
      turn,
      number: number + pick([...at, number, 1], [0, 0, 3]),
      summary: SUMMARIES[number - 1] ?? "",
      kind: "radio",
      options: [
        { letter: "A", name: "First" },
        { letter: "B", name: "Second" },
      ],
    })),
  };
};

/** One record of any kind the adapter reads or skips, drawn at `at`. */
const record = (at: At): TranscriptRecord => {
  const id = pick([...at, 0], IDS);
  const text = pick([...at, 1], PROMPTS);
  const reply = pick([...at, 2], REPLIES);
  const kinds: readonly (() => TranscriptRecord)[] = [
    () => human(id, text),
    () => human(id, text),
    () => human(id, text),
    () => peer(id, text),
    () => notification(id, text),
    () => pluginPrompt(id, text),
    () => otherPluginPrompt(id, text),
    () => submitted(id, text),
    () => submitted(id, text),
    () => submitted(id, text, "other-mod"),
    () => ({ ...submitted(id, text), isSidechain: true }),
    () => pluginRow(text),
    () => ({ ...pluginPrompt(id, text), pluginPrompt: { name: PLUGIN, text: 42 } }),
    () => sdkPrompt(id, text),
    () => ({ ...human(id, text), turnOrigin: "scheduled", origin: undefined }),
    () => ({ ...peer(id, text), isSidechain: true }),
    () => ({ ...notification(id, text), isSidechain: true }),
    () => ({ ...human(id, text), promptId: undefined }),
    () => compactSummary(id),
    () => ({ ...human(id, text), isSidechain: true }),
    () => ({ ...human(id, text), turnOrigin: "system" }),
    () => engineRow("<system-reminder>x</system-reminder>", { isMeta: true }),
    () => skillBody(),
    () => commandOutput(id),
    () => toolResult(),
    () => assistant(reply),
    () => assistant(reply),
    () => assistant(reply, [call([...at, 4])]),
    () => assistant(reply, [call([...at, 4])]),
    () => assistant(reply, [], { isSidechain: true }),
    () => queued(text),
    () => queued(text, "peer"),
    () => queued(text, "task-notification"),
    () => queued(text, "system"),
    () => ({ ...queued(text), isSidechain: true }),
  ];

  return pick([...at, 3], kinds)();
};

/** The random record sequences, the same every run. */
const sequences = (): readonly (readonly TranscriptRecord[])[] =>
  Array.from({ length: SEQUENCES }, (_, s) =>
    Array.from({ length: 1 + below([s], LONGEST) }, (_, r) => record([s, r])),
  );

/** The prompt ids of a sequence's records that open a turn, a repeat each time it comes. */
const promptIds = (records: readonly TranscriptRecord[]): readonly unknown[] =>
  records
    .filter((one) => turnsOf([one]).length === 1)
    .map((one) => one.promptId);

const fieldOf = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null
    ? (value as Readonly<Record<string, unknown>>)[key]
    : undefined;

/**
 * A record as the oracle is handed it: a prompt a plugin sent as the user,
 * which the oracle can't read, in the `pluginPrompt` shape it reads as the
 * same plugin's prompt; any other record as it is.
 */
const forOracle = (record: TranscriptRecord): TranscriptRecord => {
  const content = fieldOf(record.message, "content");

  return fieldOf(record.origin, "kind") === "plugin" &&
    record.pluginPrompt === undefined &&
    (record.turnOrigin !== undefined || record.isMeta !== true)
    ? {
        ...record,
        pluginPrompt: {
          name: fieldOf(record.origin, "name"),
          text: typeof content === "string" ? content : "",
        },
      }
    : record;
};

/** A turn as the comparison reads it: the user's own texts apart from the others', and the Decide items raised. */
type Compared = Readonly<{
  id: string;
  prompt: string;
  isOwn: boolean;
  replies: readonly string[];
  decide: unknown;
  asides: readonly string[];
  reports: readonly string[];
}>;

/** A neutral turn as the comparison reads it. */
const comparedOf = (turn: Turn): Compared => ({
  id: turn.id,
  prompt: turn.prompt.text,
  isOwn: isOwn(turn.prompt.owner),
  replies: turn.replies,
  decide: turn.decide,
  asides: turn.messages.filter((m) => isOwn(m.owner)).map((m) => m.text),
  reports: turn.messages.filter((m) => !isOwn(m.owner)).map((m) => m.text),
});

/** The oracle's turn as the comparison reads it: its calls' Decide items. */
const comparedOfOracle = ({ calls, ...rest }: oracleTranscript.Turn): Compared => ({
  ...rest,
  decide: calls.flatMap(itemsOf),
});

/** The turns with the messages the user sent while they ran left out. */
const withoutAsides = (turns: readonly Turn[]): readonly Turn[] =>
  turns.map((turn) => ({
    ...turn,
    messages: turn.messages.filter((m) => !isOwn(m.owner)),
  }));

const answeredCount = (turns: readonly Turn[]): number =>
  core.settlementsOf(turns).filter((s) => s.how === "answered").length;

/** Runs `check`, its failure saying which sequence and how many of its records. */
const at = (sequence: number, length: number, check: () => void): void => {
  try {
    check();
  } catch (error) {
    throw new Error(
      `sequence ${sequence}, its first ${length} records: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
};

/** Everything the core reads from the turns, by the core's functions or the oracle's. */
const outcomes = <T>(
  turns: readonly T[],
  read: Readonly<{
    reassessStart: (turns: readonly T[]) => number;
    windowStart: (turns: readonly T[], window: number) => number;
    allItems: (turns: readonly T[]) => unknown;
    answered: (turns: readonly T[]) => unknown;
    rollUp: (turns: readonly T[], window: number) => readonly core.ListItem[];
    unsettled: (
      turns: readonly T[],
      items: readonly core.ListItem[],
      merged: ReadonlySet<string>,
    ) => unknown;
    pullRequestsToAsk: (turns: readonly T[], window: number) => unknown;
    countLine: (turns: readonly T[], window: number, merged: ReadonlySet<string>) => string;
    decideStates: (turns: readonly T[]) => unknown;
    openOf: (turns: readonly T[], window: number, merged: ReadonlySet<string>) => unknown;
  }>,
) => ({
  reassessStart: read.reassessStart(turns),
  allItems: read.allItems(turns),
  answered: read.answered(turns),
  decideStates: read.decideStates(turns),
  windows: WINDOWS.map((window) => ({
    windowStart: read.windowStart(turns, window),
    rollUp: read.rollUp(turns, window),
    pullRequestsToAsk: read.pullRequestsToAsk(turns, window),
    merged: MERGED.map((merged) => ({
      unsettled: read.unsettled(turns, read.rollUp(turns, window), merged),
      countLine: read.countLine(turns, window, merged),
      openOf: read.openOf(turns, window, merged),
    })),
  })),
});

describe("the adapter and the core on neutral turns, against the oracle", () => {
  const all = sequences();

  const read = all.map((records) => turnsOf(records));

  test("the sequences reach every owner, repeats and reassess turns", () => {
    expect(new Set(read.flat().map((turn) => turn.prompt.owner))).toEqual(
      new Set(["user", "this-plugin", "other-plugin", "peer", "notification"]),
    );
    expect(read.filter((turns) => reassessStart(turns) > 0).length).toBeGreaterThan(SEQUENCES / 10);
    expect(
      all.filter((records) => new Set(promptIds(records)).size < promptIds(records).length).length,
    ).toBeGreaterThan(SEQUENCES / 10);
  });

  test("the sequences settle a Waiting item by a report, and a Decide item by an aside", () => {
    expect(
      read.filter((turns) =>
        core
          .rollUp(turns, 20)
          .some((item) => item.list === "waiting" && core.unsettled(turns, [item], new Set()).length === 0),
      ).length,
    ).toBeGreaterThan(0);
    expect(
      read.filter((turns) => answeredCount(turns) > answeredCount(withoutAsides(turns))).length,
    ).toBeGreaterThan(0);
  });

  test("give the same turns and the same outcomes after every record", () => {
    all.forEach((records, sequence) => {
      for (const length of records.map((_, n) => n + 1)) {
        const prefix = records.slice(0, length);
        const neutral = turnsOf(prefix);
        const old = oracleTranscript.turnsOf(prefix.map(forOracle));
        at(sequence, length, () => {
          expect(neutral.map(comparedOf)).toEqual(old.map(comparedOfOracle));
          expect(outcomes(neutral, { ...core, reassessStart })).toEqual(
            outcomes(old, { ...oracle, reassessStart: oracleTranscript.reassessStart }),
          );
        });
      }
    });
  });
});
