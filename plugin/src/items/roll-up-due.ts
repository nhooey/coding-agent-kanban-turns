// When the full 📌 roll-up is due, by the roll-up interval the spec gives:
// once min(`most-minutes`, `times` × the average duration of the last
// `turns` completed turns) has passed since the last final response that
// printed it in full; until then the final response closes on the count
// line, which doesn't restart the clock.
//
// A turn's duration runs from its prompt to the next turn's prompt, so
// only a turn the next prompt has closed is completed. A time the turns
// don't give is unknown: a duration missing either end is left out of the
// average, an average of none leaves the interval at its most, and a
// session whose last full roll-up's time is unknown, or that has none yet,
// has it due.

import type { Turn } from "../../types/index.d.ts";
import { SPEC } from "../protocol/spec.ts";
import { parseReply } from "../harness/reply.ts";

const INTERVAL = SPEC["roll-up"].interval;
const MINUTE = 60_000;

/** Whether the full roll-up is due, or how long until it is, in milliseconds. */
export type Due = Readonly<{ full: true } | { full: false; left: number }>;

/** A time a turn gives, in milliseconds; undefined where it gives none, or one that doesn't parse. */
const timeOf = (text: string | undefined): number | undefined => {
  const time = text === undefined ? Number.NaN : Date.parse(text);

  return Number.isNaN(time) ? undefined : time;
};

/** Whether a final response prints the full roll-up: one of its lines outside a code block is the roll-up's header, as parseReply reads the response. */
export const printsFullRollUp = (text: string): boolean =>
  parseReply(text).some((block) => block.kind === "roll-up");

/** Each completed turn's duration whose prompt and the next turn's prompt give their times, oldest first, in milliseconds. */
export const turnDurations = (turns: readonly Turn[]): readonly number[] =>
  turns.slice(0, -1).flatMap((turn, n) => {
    const start = timeOf(turn.promptedAt);
    const end = timeOf(turns[n + 1]?.promptedAt);

    return start === undefined || end === undefined || end < start ? [] : [end - start];
  });

/** The roll-up interval the turns give, in milliseconds. */
export const rollUpInterval = (turns: readonly Turn[]): number => {
  const last = turnDurations(turns).slice(-INTERVAL.turns);
  const most = INTERVAL["most-minutes"] * MINUTE;
  const total = last.reduce((sum, duration) => sum + duration, 0);

  return last.length === 0 ? most : Math.min(most, (INTERVAL.times * total) / last.length);
};

/** When the last final response that printed the full roll-up came; undefined where none did, or its time is unknown. */
const lastFullAt = (turns: readonly Turn[]): number | undefined =>
  timeOf(
    turns.findLast((turn) => turn.unanswered !== true && printsFullRollUp(turn.replies.at(-1) ?? ""))
      ?.answeredAt,
  );

/** Whether the full roll-up is due at `now`, in milliseconds, or how long until it is. */
export const rollUpDue = (turns: readonly Turn[], now: number): Due => {
  const since = lastFullAt(turns);
  const left = since === undefined ? 0 : since + rollUpInterval(turns) - now;

  return left > 0 ? { full: false, left } : { full: true };
};
