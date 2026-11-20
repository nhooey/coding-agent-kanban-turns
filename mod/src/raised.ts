// The Decide items raised in this session, oldest first: every item a
// `kanban_options` call drew or a refresh found open, kept once raised, with
// which are settled and which the pane has been opened over. Each function
// takes the items and returns new ones, or a part of them; none changes
// what it's given.

import { isAnswered } from "./answers.ts";
import { refOf } from "./items.ts";
import type { DecideItem, Raised } from "../types/index.d.ts";

export const emptyRaised: Raised = {
  session: "",
  items: [],
  settledRefs: [],
  seenRefs: [],
  problem: "",
  warnings: [],
};

/** The items raised in `session`: as they stand when they're that session's, else none. */
export const forSession = (raised: Raised, session: string): Raised =>
  raised.session === session ? raised : { ...emptyRaised, session };

/** `items` with each ref kept once, at its first place, holding its last content. */
const byRef = (items: readonly DecideItem[]): readonly DecideItem[] => {
  const latest = new Map(items.map((item) => [refOf(item), item]));

  return [...latest.keys()].flatMap((ref) => latest.get(ref) ?? []);
};

/** The items once `items` are merged in: one raised before keeps its place and takes the newer content; a new one goes at the end. */
export const withItems = (
  raised: Raised,
  items: readonly DecideItem[],
): Raised => ({ ...raised, items: byRef([...raised.items, ...items]) });

/** The items once a refresh read the transcript and found `open`: those merged in, and every raised item not among them settled. */
export const refreshed = (
  raised: Raised,
  open: readonly DecideItem[],
  warnings: readonly string[],
): Raised => {
  const merged = withItems(raised, open);
  const openRefs = open.map(refOf);

  return {
    ...merged,
    settledRefs: merged.items
      .map(refOf)
      .filter((ref) => !openRefs.includes(ref)),
    problem: "",
    warnings,
  };
};

/** The items once a refresh couldn't read the transcript, for `problem`: each raised item settled or open as it was. */
export const unread = (
  raised: Raised,
  problem: string,
  warnings: readonly string[],
): Raised => ({ ...raised, problem, warnings });

/** What the pane says is wrong: the settings files' problems, then the read's, in one line; empty when nothing is. */
export const problemsOf = (raised: Raised): string =>
  [...raised.warnings, raised.problem].filter((p) => p !== "").join("; ");

/** Whether the last refresh found the item no longer open. */
export const isSettled = (raised: Raised, item: DecideItem): boolean =>
  raised.settledRefs.includes(refOf(item));

/** The raised items not settled, oldest first. */
export const stillOpen = (raised: Raised): readonly DecideItem[] =>
  raised.items.filter((item) => !isSettled(raised, item));

/** The open items raised since the last look: what opens the pane by itself. */
export const unseen = (raised: Raised): readonly DecideItem[] =>
  stillOpen(raised).filter((item) => !raised.seenRefs.includes(refOf(item)));

/** The items with every one of them looked at. */
export const seen = (raised: Raised): Raised => ({
  ...raised,
  seenRefs: raised.items.map(refOf),
});

/** The first open item the draft doesn't answer, if there is one. */
export const firstUnanswered = (
  raised: Raised,
  draft: string,
): DecideItem | undefined =>
  stillOpen(raised).find((item) => !isAnswered(draft, item));
