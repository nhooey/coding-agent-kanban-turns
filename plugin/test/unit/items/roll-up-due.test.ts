// When the full 📌 roll-up is due, src/items/roll-up-due.ts: once the
// roll-up interval has passed since the last final response that printed
// it in full, the interval read from the turns' times, a time they don't
// give being unknown.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  printsFullRollUp,
  rollUpDue,
  rollUpInterval,
  turnDurations,
} from "../../../src/items/roll-up-due.ts";
import { SPEC } from "../../../src/protocol/spec.ts";
import type { Turn } from "../../../types/index.d.ts";

const MINUTE = 60_000;
const START = Date.parse("2026-11-16T20:00:00.000Z");
const INTERVAL = SPEC["roll-up"].interval;

/** A time `minutes` after the start, as a transcript gives it. */
const at = (minutes: number): string => new Date(START + minutes * MINUTE).toISOString();

const FULL = `Done.\n\n${SPEC["roll-up"].glyph} **${SPEC["roll-up"].header}:**  \n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚧 **Pending:**  \n- **A thing** 🔖 0f311c94₋₁\n`;
const COUNTS = `Done.\n\n${SPEC["roll-up"].glyph} ${SPEC["roll-up"]["count-label"]}: 🚧 1\n`;

/** A turn prompted at `prompted` minutes and answered at `answered`, its final response `reply`; a time left out is unknown. */
const turn = (
  id: string,
  prompted: number | undefined,
  answered: number | undefined,
  reply = "Done.",
): Turn => ({
  id,
  prompt: { owner: "user", text: "Go on.", reportNames: undefined },
  replies: [reply],
  decide: [],
  messages: [],
  ...(prompted === undefined ? {} : { promptedAt: at(prompted) }),
  ...(answered === undefined ? {} : { answeredAt: at(answered) }),
});

describe("printsFullRollUp", () => {
  test("finds the full roll-up's header, and no other name in its place", () => {
    expect(printsFullRollUp(FULL)).toBe(true);
    expect(printsFullRollUp(`${SPEC["roll-up"].glyph} **Left from before:**\n`)).toBe(false);
  });

  test("finds none in the count line, or a reply without either", () => {
    expect(printsFullRollUp(COUNTS)).toBe(false);
    expect(printsFullRollUp("Done.")).toBe(false);
  });

  test("finds none in a code block, fenced by backticks or tildes, but one after the block closes", () => {
    expect(printsFullRollUp(`An example:\n\n\`\`\`text\n${FULL}\`\`\`\n`)).toBe(false);
    expect(printsFullRollUp(`An example:\n\n~~~\n${FULL}~~~\n`)).toBe(false);
    expect(printsFullRollUp(`\`\`\`text\nx\n\`\`\`\n\n${FULL}`)).toBe(true);
  });

  test("keeps a block open until its own fence closes it", () => {
    expect(printsFullRollUp(`\`\`\`\n~~~\n${FULL}\`\`\`\n`)).toBe(false);
  });

  test("reads fences as parseReply does: a block left open holds the rest, and a closing fence is at least as long", () => {
    expect(printsFullRollUp(`\`\`\`\n${FULL}`)).toBe(false);
    expect(printsFullRollUp(`\`\`\`\`\n\`\`\`\n${FULL}\`\`\`\`\n`)).toBe(false);
    expect(printsFullRollUp(`\`\`\`text\n\`\`\` x\n${FULL}`)).toBe(false);
  });
});

describe("turnDurations", () => {
  test("runs each turn from its prompt to the next turn's, so the latest, which no prompt has closed, has none", () => {
    expect(turnDurations([turn("aaaaaaa1", 0, 1), turn("aaaaaaa2", 4, 5), turn("aaaaaaa3", 10, 11)])).toEqual([
      4 * MINUTE,
      6 * MINUTE,
    ]);
  });

  test("leaves out a duration whose prompt or next prompt gives no time", () => {
    expect(
      turnDurations([turn("aaaaaaa1", 0, 1), turn("aaaaaaa2", undefined, 5), turn("aaaaaaa3", 10, 11), turn("aaaaaaa4", 12, 13)]),
    ).toEqual([2 * MINUTE]);
  });

  test("leaves out a time that doesn't parse, and a turn its next prompt comes before", () => {
    const unparsed = { ...turn("aaaaaaa1", 0, 1), promptedAt: "yesterday" };

    expect(turnDurations([unparsed, turn("aaaaaaa2", 4, 5)])).toEqual([]);
    expect(turnDurations([turn("aaaaaaa1", 9, 9), turn("aaaaaaa2", 4, 5)])).toEqual([]);
  });
});

describe("rollUpInterval", () => {
  test("is the spec's times the average of the last completed turns, its turns at most", () => {
    const turns = [0, 30, 31, 32, 33, 34, 35].map((minutes, n) => turn(`aaaaaaa${n}`, minutes, minutes));

    // The first turn's 30 minutes fall outside the last 5.
    expect(INTERVAL.turns).toBe(5);
    expect(rollUpInterval(turns)).toBe(INTERVAL.times * MINUTE);
  });

  test("is the spec's most where the average would make it longer", () => {
    expect(rollUpInterval([turn("aaaaaaa1", 0, 1), turn("aaaaaaa2", 60, 61)])).toBe(INTERVAL["most-minutes"] * MINUTE);
  });

  test("is the spec's most where no completed turn gives its duration", () => {
    expect(rollUpInterval([turn("aaaaaaa1", undefined, undefined), turn("aaaaaaa2", 1, 2)])).toBe(
      INTERVAL["most-minutes"] * MINUTE,
    );
    expect(rollUpInterval([])).toBe(INTERVAL["most-minutes"] * MINUTE);
  });
});

describe("rollUpDue", () => {
  // Turns a minute apart, so the interval is 5 × 1 minute.
  const spaced = (replies: readonly string[]): readonly Turn[] =>
    replies.map((reply, n) => turn(`aaaaaaa${n}`, n, n + 0.5, reply));

  test("is full in a session with no full roll-up yet", () => {
    expect(rollUpDue(spaced(["Done.", COUNTS, "Done."]), START + 3 * MINUTE)).toEqual({ full: true });
  });

  test("leaves the time until the interval has passed since the last full roll-up", () => {
    const turns = spaced(["Done.", FULL, COUNTS, "Done."]);

    // The full roll-up came at 1.5 minutes, and the interval is 5 minutes.
    expect(rollUpDue(turns, START + 4 * MINUTE)).toEqual({ full: false, left: 2.5 * MINUTE });
    expect(rollUpDue(turns, START + 6.5 * MINUTE)).toEqual({ full: true });
  });

  test("leaves the count line out of the clock: only a full roll-up restarts it", () => {
    const turns = spaced([FULL, COUNTS, COUNTS, COUNTS, COUNTS, COUNTS, "Done."]);

    expect(rollUpDue(turns, START + 6 * MINUTE)).toEqual({ full: true });
  });

  test("is full where the last full roll-up's time is unknown, or its turn is unanswered", () => {
    const unknown = [turn("aaaaaaa1", 0, undefined, FULL), turn("aaaaaaa2", 1, 1.5)];
    const unanswered = [{ ...turn("aaaaaaa1", 0, 0.5, FULL), unanswered: true as const }, turn("aaaaaaa2", 1, 1.5)];

    expect(rollUpDue(unknown, START + 2 * MINUTE)).toEqual({ full: true });
    expect(rollUpDue(unanswered, START + 2 * MINUTE)).toEqual({ full: true });
  });

  test("reads a full roll-up in a turn's final response alone, not in a response on the way", () => {
    const onTheWay = { ...turn("aaaaaaa1", 0, 0.5, FULL), replies: [FULL, "Done."] };

    expect(rollUpDue([onTheWay, turn("aaaaaaa2", 1, 1.5)], START + 2 * MINUTE)).toEqual({ full: true });
  });
});
