// The Decide items raised in this session, oldest first: every item a
// `kanban_options` call drew or a refresh found open, kept once raised,
// each holding where it stands, and which the pane has been opened over.
// Each function takes the items and returns new ones, or a part of them;
// none changes what it's given.

import { answerTo, isAnswered } from "./answers.ts";
import { refOf } from "./items.ts";
import type {
  DecideItem,
  Held,
  HowSettled,
  ItemState,
  Raised,
  RaisedItem,
  Settlement,
} from "../../types/index.d.ts";

const OPEN: ItemState = { tag: "open" };

export const emptyRaised: Raised = {
  session: "",
  turns: [],
  items: [],
  seenRefs: [],
  problem: "",
  settingsProblems: [],
};

/** The items raised in `session`: as they stand when they're that session's, else none. */
export const forSession = (raised: Raised, session: string): Raised =>
  raised.session === session ? raised : { ...emptyRaised, session };

/** The raised Decide items, oldest first, settled or open. */
export const decideItemsOf = (raised: Raised): readonly DecideItem[] =>
  raised.items.map((each) => each.item);

/** Each of `all` by its ref, the last one for a ref given twice. */
const lastByRef = <T>(
  all: readonly T[],
  refOfEach: (each: T) => string,
): ReadonlyMap<string, T> => new Map(all.map((each) => [refOfEach(each), each]));

/** How a settlement says its item settled, its ref left out. */
const howOf = ({ ref: _ref, ...how }: Settlement): HowSettled => how;

/** Settled, as `settled` says how, where it says: its ref left out, the item's being the one. */
const settledBy = (settled: Settlement | undefined): ItemState =>
  settled === undefined
    ? { tag: "settled" }
    : { tag: "settled", settlement: howOf(settled) };

/** A raised item holding `item`'s newer content, where `latest` has one for its ref, standing where it stood. */
const withContent = (
  each: RaisedItem,
  latest: ReadonlyMap<string, DecideItem>,
): RaisedItem => {
  const item = latest.get(refOf(each.item));

  return item === undefined ? each : { item, state: each.state };
};

/** The items once `items` are merged in: one raised before keeps its place and where it stands, and takes the newer content; a new one goes at the end, open. */
export const withItems = (
  raised: Raised,
  items: readonly DecideItem[],
): Raised => {
  const latest = lastByRef(items, refOf);
  const known = new Set(decideItemsOf(raised).map(refOf));

  return {
    ...raised,
    items: [
      ...raised.items.map((each) => withContent(each, latest)),
      ...[...latest.values()]
        .filter((item) => !known.has(refOf(item)))
        .map((item) => ({ item, state: OPEN })),
    ],
  };
};

/**
 * The items once a refresh read the transcript and found `open`: those
 * merged in and open, and every raised item not among them settled, as
 * the last of `settlements` for its ref says how; `turns`, the ids of the
 * turns it read, kept for the pane's turn headers.
 */
export const refreshed = (
  raised: Raised,
  open: readonly DecideItem[],
  settlements: readonly Settlement[],
  settingsProblems: readonly string[],
  turns: readonly string[] = [],
): Raised => {
  const openRefs = new Set(open.map(refOf));
  const lastSettled = lastByRef(settlements, (settled) => settled.ref);

  return {
    ...raised,
    items: withItems(raised, open).items.map((each) => ({
      ...each,
      state: openRefs.has(refOf(each.item))
        ? OPEN
        : settledBy(lastSettled.get(refOf(each.item))),
    })),
    turns,
    problem: "",
    settingsProblems,
  };
};

/** Where the raised item with the item's ref stands; undefined when none is raised. */
const stateOf = (raised: Raised, item: DecideItem): ItemState | undefined =>
  raised.items.find((each) => refOf(each.item) === refOf(item))?.state;

/** How the item settled, as the last refresh found or Submit sent, naming the item by its ref; undefined when it's open, or settled in a way the transcript doesn't say. */
export const settlementOf = (
  raised: Raised,
  item: DecideItem,
): Settlement | undefined => {
  const state = stateOf(raised, item);

  return state?.tag === "settled" && state.settlement !== undefined
    ? { ref: refOf(item), ...state.settlement }
    : undefined;
};

/** The items once a refresh couldn't read the transcript, for `problem`: each raised item settled or open as it was. */
export const unread = (
  raised: Raised,
  problem: string,
  settingsProblems: readonly string[],
): Raised => ({ ...raised, problem, settingsProblems });

/** What the pane says is wrong: the settings files' problems, then the read's, in one line; empty when nothing is. */
export const problemsOf = (raised: Raised): string =>
  [...raised.settingsProblems, raised.problem]
    .filter((p) => p !== "")
    .join("; ");

/** Whether the last refresh found the item no longer open, or Submit sent an answer to it. */
export const isSettled = (raised: Raised, item: DecideItem): boolean =>
  stateOf(raised, item)?.tag === "settled";

/** The raised items not settled, oldest first. */
export const stillOpen = (raised: Raised): readonly DecideItem[] =>
  raised.items
    .filter((each) => each.state.tag === "open")
    .map((each) => each.item);

/** The open items raised since the last look: what opens the pane by itself. */
export const unseen = (raised: Raised): readonly DecideItem[] =>
  stillOpen(raised).filter((item) => !raised.seenRefs.includes(refOf(item)));

/** The items with every one of them looked at. */
export const seen = (raised: Raised): Raised => ({
  ...raised,
  seenRefs: decideItemsOf(raised).map(refOf),
});

/**
 * What the pane's Submit sends for the items: one `sent` settlement for
 * each raised item the draft answers, open or answered again once Done,
 * with its letters and note.
 */
export const sentOf = (draft: string, raised: Raised): readonly Settlement[] =>
  decideItemsOf(raised).flatMap((item) => {
    const answer = answerTo(draft, item);

    return answer === undefined
      ? []
      : [
          {
            ref: refOf(item),
            how: "sent" as const,
            letters: answer.letters,
            note: answer.note,
          },
        ];
  });

/** A raised item Done by the answer `lastSent` holds for its ref, where it holds one; else as it stood. */
const doneBySent = (
  each: RaisedItem,
  lastSent: ReadonlyMap<string, Settlement>,
): RaisedItem => {
  const sent = lastSent.get(refOf(each.item));

  return sent === undefined ? each : { ...each, state: settledBy(sent) };
};

/**
 * The items as the pane and a reply draw them while answers Submit sent
 * wait for the turn's end: each raised item a `sent` settlement names Done
 * with it, in place of what an earlier answer said of a Done one, since
 * the sent answer is the later.
 */
export const withSent = (
  raised: Raised,
  sent: readonly Settlement[],
): Raised => {
  const lastSent = lastByRef(sent, (settled) => settled.ref);

  return raised.items.some((each) => lastSent.has(refOf(each.item)))
    ? { ...raised, items: raised.items.map((each) => doneBySent(each, lastSent)) }
    : raised;
};

/** Whether two holds are one press's answer to one item. */
const isSameHold = (a: Held, b: Held): boolean =>
  a.press === b.press && a.settled.ref === b.settled.ref;

/**
 * The answers Submit holds Done once press `press` sends `moved`: each
 * tagged with the press, at the end, in place of any the press held for
 * its ref before. Another press's hold for the same item stays, so the
 * press's refusal can't take it back.
 */
export const withHeld = (
  sent: readonly Held[],
  press: number,
  moved: readonly Settlement[],
): readonly Held[] => {
  const holds = moved.map((settled) => ({ press, settled }));

  return [...sent.filter((h) => !holds.some((m) => isSameHold(h, m))), ...holds];
};

/** The answers held once press `press` puts its own back: every other press's kept, one for the same item among them. */
export const released = (
  sent: readonly Held[],
  press: number,
): readonly Held[] => sent.filter((h) => h.press !== press);

/**
 * The answers held once a refresh has read the transcript the holds `read`
 * went into: those taken out, each by its press and item, and any held
 * since kept, a later press's answer to the same item among them.
 */
export const withoutRead = (
  sent: readonly Held[],
  read: readonly Held[],
): readonly Held[] => sent.filter((h) => !read.some((r) => isSameHold(h, r)));

/** What the held answers make Done: each item's most recently held answer, in the order they were held. */
export const heldNow = (sent: readonly Held[]): readonly Settlement[] =>
  sent
    .filter(
      (h, n) => !sent.slice(n + 1).some((later) => later.settled.ref === h.settled.ref),
    )
    .map((h) => h.settled);

/**
 * Whether a Submit that went through closes the pane: with `isEnabled`, the
 * `pane.close-when-all-submitted` setting, once the answers `sent`, this
 * Submit's and any earlier one's the turn's end hasn't read, leave no item
 * open.
 */
export const closesOnSubmit = (
  raised: Raised,
  sent: readonly Settlement[],
  isEnabled: boolean,
): boolean => isEnabled && stillOpen(withSent(raised, sent)).length === 0;

/** How many open items the draft answers. */
export const answeredCount = (raised: Raised, draft: string): number =>
  stillOpen(raised).filter((item) => isAnswered(draft, item)).length;
