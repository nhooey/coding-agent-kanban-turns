// The pane's groups, worked out apart from drawing them: three branches,
// the open items, the queued ones the draft answers, and the Done ones, each
// under a toggle naming its count; in each, one group per turn, newest
// first, under a faint header naming the turn, its index and its count, a
// toggle of its own that folds that turn's items in that branch alone;
// which toggles a click opened or closed, which no move of an item between
// branches changes; where the ring goes when a pick moves its item out of
// Open; and the stops the pane's j and k keys move the focus ring between.
// Within a turn's group the items come by list, in the spec's order, each
// list's run under a faint header naming it. No `$`, no I/O.

import { isAnswered, settles } from "../items/answers.ts";
import { isDecide, isSameTurn, listOf, refOf } from "../items/items.ts";
import {
  DECIDE,
  DONE,
  PANE_LISTS,
  itemLabel,
  paneListOf,
  settlingWordsOf,
} from "../protocol/rules.ts";
import type { ListName } from "../protocol/rules.ts";
import { SPEC } from "../protocol/spec.ts";
import { padToCells, widestCells } from "../text/cells.ts";
import { LAYOUT } from "./layout.ts";
import type {
  Folds,
  ItemState,
  ListedItem,
  RaisedItem,
  Settings,
} from "../../types/index.d.ts";

/** The pane's three branches, in its order: the open items, the ones the draft answers, then the Done ones. */
export type Branch = "open" | "queued" | "done";

/** The branches in the order the pane draws them. */
export const BRANCHES: readonly Branch[] = ["open", "queued", "done"];

/** What each branch's header names it: the Done one as the spec names the Done list. */
export const BRANCH_NAMES: Readonly<Record<Branch, string>> = {
  open: "Open",
  queued: "Queued",
  done: DONE.header,
};

/** The branch each raised item's state puts it in before the draft is read: a state with no branch fails to type-check, so none drops out of the pane. */
const BRANCH_OF_TAG: Readonly<Record<ItemState["tag"], Branch>> = {
  open: "open",
  settled: "done",
};

/** One turn's items in one branch: its id, the key of its header's toggle, its id and index as the header names it, and its items, by list in the spec's order, each list's oldest first. */
export type TurnGroup = Readonly<{
  turn: string;
  key: string;
  label: string;
  items: readonly ListedItem[];
}>;

/** Where an item's list comes in the spec's order, among the lists the pane draws. */
const listRank = (item: ListedItem): number =>
  PANE_LISTS.findIndex((list) => list.header === item.list);

/** The items by list, in the spec's order, each list's in the order given. */
export const byList = (items: readonly ListedItem[]): readonly ListedItem[] =>
  items.toSorted((a, b) => listRank(a) - listRank(b));

/** One list's run of items in a turn's group: the list and its header's text, `👉 Todo`, and its items. */
export type ListRun = Readonly<{
  list: ListName;
  header: string;
  items: readonly ListedItem[];
}>;

/** A list's header in a turn's group: its glyph and its name, `👉 Todo`. */
export const listHeader = (list: ListName): string => `${list.glyph} ${list.header}`;

/** A turn's group's items as one run per list, in the spec's order, a list with no item left out. */
export const listRuns = (items: readonly ListedItem[]): readonly ListRun[] =>
  PANE_LISTS.map((list) => ({
    list,
    header: listHeader(list),
    items: items.filter((item) => item.list === list.header),
  })).filter((run) => run.items.length > 0);

/** The pane's branches, each one group per turn with an item in it, newest first. */
export type PaneGroups = Readonly<Record<Branch, readonly TurnGroup[]>>;

/** The marks a toggle opens on: one while it's collapsed, one while it's expanded. */
type ToggleMarks = Pick<Settings["marks"], "collapsed" | "expanded">;

/** A turn's index counting back from the latest turn the transcript holds, which is 0; undefined for a turn not read. */
export const relativeIndex = (
  turns: readonly string[],
  turn: string,
): number | undefined => {
  const at = turns.findLastIndex((id) => isSameTurn(id, turn));

  return at < 0 ? undefined : at - (turns.length - 1);
};

const SUBSCRIPT: Readonly<Record<string, string>> = {
  ...Object.fromEntries(
    [..."0123456789"].map((d, n) => [d, [...SPEC.tag.digits][n] ?? d]),
  ),
  "-": SPEC.tag.minus,
};

/** A relative index in Unicode subscript, as the kanban skill's 🔖 tag writes it: `₀`, `₋₃`. */
export const subscriptOf = (index: number): string =>
  [...String(index)].map((c) => SUBSCRIPT[c] ?? c).join("");

/** How a turn's header names it: its id and its index, `9efb08a1 ₋₃`; the id alone for a turn not read. */
export const turnLabel = (turn: string, index: number | undefined): string =>
  index === undefined ? turn : `${turn} ${subscriptOf(index)}`;

/** A name and how many items it holds, `Done (2)`: a toggle's label. */
export const countedLabel = (name: string, count: number): string =>
  `${name} (${count})`;

/** A toggle's mark, the `marks` setting's, padded to the wider of the two so the text after it stays put as it toggles. */
const toggleMark = (isExpanded: boolean, marks: ToggleMarks): string =>
  padToCells(
    isExpanded ? marks.expanded : marks.collapsed,
    widestCells([marks.collapsed, marks.expanded]),
  );

/**
 * A turn's header in a branch: a toggle, its mark, then the turn's label and
 * its count in that branch between rules, `▾ ── 9efb08a1 ₋₃ (2) ──`.
 */
export const turnHeader = (
  label: string,
  count: number,
  isExpanded: boolean,
  marks: ToggleMarks,
): string =>
  `${toggleMark(isExpanded, marks)} ${LAYOUT.rule} ${countedLabel(label, count)} ${LAYOUT.rule}`;

/** A branch's header: a toggle, `▾ Open (3)` while expanded, `▸ Done (2)` while collapsed, its count every item's in the branch. */
export const branchHeader = (
  branch: Branch,
  count: number,
  isExpanded: boolean,
  marks: ToggleMarks,
): string =>
  `${toggleMark(isExpanded, marks)} ${countedLabel(BRANCH_NAMES[branch], count)}`;

/** The key of a turn's header in a branch, `open.9efb08a1`: each folds that turn's items in its own branch. */
export const turnKey = (branch: Branch, turn: string): string =>
  `${branch}.${turn}`;

/** The key of a Done item's line, or of its box's title once a click expands it. */
export const lineKey = (item: ListedItem): string => `${refOf(item)}.line`;

/**
 * Where a raised item stands in the pane: Done once settled; Queued while
 * the draft's choice would settle it, as `settles` says, a pick or a note
 * to a Decide item, a settling word to a Todo item, waiting for Submit,
 * unless it's the one `heldAfterPick` holds in Open (`held`, its ref), or
 * the draft's line for it asks a question, which Submit sends without
 * settling it; else Open, a Todo item the draft gives a note alone among
 * them.
 */
export const paneStateOf = (
  raised: RaisedItem,
  draft: string,
  held = "",
): Branch => {
  const branch = BRANCH_OF_TAG[raised.state.tag];

  return branch === "open" &&
    settles(draft, raised.item) &&
    refOf(raised.item) !== held
    ? "queued"
    : branch;
};

/**
 * The item held in Open once a pick lands on it in `branch`, by ref: a
 * checkbox item picked in Open, which takes more than one pick, so it stays
 * under the person's hands until the ring leaves it; empty for any other.
 */
export const heldAfterPick = (
  item: ListedItem,
  branch: Branch | undefined,
): string =>
  isDecide(item) && item.kind === "checkbox" && branch === "open"
    ? refOf(item)
    : "";

/** The item still held once the ring lands on `focused`: the held one while the ring is on one of its elements, else none. */
export const heldAfterFocus = (held: string, focused: string): string =>
  held !== "" && focused.startsWith(`${held}.`) ? held : "";

/**
 * Where a turn sorts, latest highest: its place among the turns read, or,
 * for a turn the transcript doesn't hold yet, after them all, in the order
 * its items were raised.
 */
const rankOf = (
  turns: readonly string[],
  turn: string,
  raisedAt: number,
): number => {
  const at = turns.findLastIndex((id) => isSameTurn(id, turn));

  return at < 0 ? turns.length + raisedAt : at;
};

/** The turns the items came from, newest first. */
const turnsNewestFirst = (
  items: readonly ListedItem[],
  turns: readonly string[],
): readonly string[] =>
  [...new Set(items.map((item) => item.turn))]
    .map((turn, raisedAt) => ({ turn, rank: rankOf(turns, turn, raisedAt) }))
    .toSorted((a, b) => b.rank - a.rank)
    .map(({ turn }) => turn);

/** A branch's groups: one per turn, in `order`, with the branch's items of that turn by list, a turn with none left out. */
const groupsOf = (
  branch: Branch,
  items: readonly ListedItem[],
  order: readonly string[],
  turns: readonly string[],
): readonly TurnGroup[] =>
  order
    .map((turn) => ({
      turn,
      key: turnKey(branch, turn),
      label: turnLabel(turn, relativeIndex(turns, turn)),
      items: byList(items.filter((item) => item.turn === turn)),
    }))
    .filter((group) => group.items.length > 0);

/**
 * The pane's groups: each branch the items `paneStateOf` puts there, one
 * group per turn with an item in it, newest first, its items by list in
 * the spec's order, Todo's before Decide's, each list's in the order they
 * were raised.
 */
export const paneGroups = (
  raised: readonly RaisedItem[],
  draft: string,
  turns: readonly string[],
  held = "",
): PaneGroups => {
  const order = turnsNewestFirst(
    raised.map((each) => each.item),
    turns,
  );
  const branchOf = (branch: Branch): readonly TurnGroup[] =>
    groupsOf(
      branch,
      raised
        .filter((each) => paneStateOf(each, draft, held) === branch)
        .map((each) => each.item),
      order,
      turns,
    );

  return { open: branchOf("open"), queued: branchOf("queued"), done: branchOf("done") };
};

/** The branch whose groups hold `item`, by its ref; undefined for an item they don't. */
export const branchOf = (
  groups: PaneGroups,
  item: ListedItem,
): Branch | undefined =>
  BRANCHES.find((branch) =>
    groups[branch].some((group) =>
      group.items.some((each) => refOf(each) === refOf(item)),
    ),
  );

/** How many items a branch's groups hold. */
export const countOf = (groups: readonly TurnGroup[]): number =>
  groups.reduce((sum, group) => sum + group.items.length, 0);

/** Where /answers scrolls: the first item the draft leaves to the person, newest turn first, as the pane draws Open: a Decide item it doesn't mention, a Todo item it gives no settling word. */
export const firstUnansweredIn = (
  groups: PaneGroups,
  draft: string,
): ListedItem | undefined =>
  groups.open
    .flatMap((group) => group.items)
    .find((item) => !(isDecide(item) ? isAnswered(draft, item) : settles(draft, item)));

/**
 * A Done item's one line in its expanded group: its label, its list's
 * glyph and name and its number, then its summary and what made it Done,
 * which wrap under the summary's start.
 */
export const doneLine = (
  item: ListedItem,
  done: string,
): Readonly<{ label: string; text: string }> => ({
  label: itemLabel(item.number, listOf(item)),
  text: `${item.summary}${LAYOUT.divider}${done}`,
});

/** A set of keys once `key` is clicked: added when it's out, taken out when it's in. */
export const toggledKey = (
  keys: readonly string[],
  key: string,
): readonly string[] =>
  keys.includes(key) ? keys.filter((held) => held !== key) : [...keys, key];

/** A set of keys with each of `added` in it, once. */
export const withKeys = (
  keys: readonly string[],
  added: readonly string[],
): readonly string[] => [...new Set([...keys, ...added])];

/** A toggle: its key, and whether it's expanded until a click says otherwise. */
export type Toggle = Readonly<{ key: string; startsOpen: boolean }>;

/** A branch's toggle, its key the branch's name: Open and Queued expanded at first, Done collapsed. */
export const branchToggle = (branch: Branch): Toggle => ({
  key: branch,
  startsOpen: branch !== "done",
});

/** A turn's toggle in a branch, expanded at first. */
export const turnToggle = (group: Pick<TurnGroup, "key">): Toggle => ({
  key: group.key,
  startsOpen: true,
});

/** A Done item's box's toggle, by its ref: its line at first, its full box once clicked. */
export const boxToggle = (item: ListedItem): Toggle => ({
  key: refOf(item),
  startsOpen: false,
});

/** No toggle clicked: every toggle as it starts. */
export const NO_FOLDS: Folds = { expanded: [], collapsed: [] };

/** Whether a toggle is expanded: one that starts expanded until a click folds it, one that starts collapsed once a click opens it. */
export const isOpen = (folds: Folds, toggle: Toggle): boolean =>
  toggle.startsOpen
    ? !folds.collapsed.includes(toggle.key)
    : folds.expanded.includes(toggle.key);

/** The folds once `toggle` is clicked. */
export const withToggled = (folds: Folds, toggle: Toggle): Folds =>
  toggle.startsOpen
    ? { ...folds, collapsed: toggledKey(folds.collapsed, toggle.key) }
    : { ...folds, expanded: toggledKey(folds.expanded, toggle.key) };

/** The folds with each of `toggles` expanded. */
export const withOpened = (folds: Folds, toggles: readonly Toggle[]): Folds => ({
  expanded: withKeys(
    folds.expanded,
    toggles.filter((toggle) => !toggle.startsOpen).map((toggle) => toggle.key),
  ),
  collapsed: folds.collapsed.filter(
    (key) => !toggles.some((toggle) => toggle.startsOpen && toggle.key === key),
  ),
});

/**
 * The folds with every level `item` is under in `branch` expanded, to scroll
 * to it: the branch, its turn there and, for a Done item, its box.
 */
export const withItemShown = (
  folds: Folds,
  item: ListedItem,
  branch: Branch,
): Folds =>
  withOpened(folds, [
    branchToggle(branch),
    turnToggle({ key: turnKey(branch, item.turn) }),
    ...(branch === "done" ? [boxToggle(item)] : []),
  ]);

/** Each toggle the groups draw, by key, and whether it's expanded: what a move of an item between branches leaves as it was. */
export const togglesShown = (
  groups: PaneGroups,
  folds: Folds,
): ReadonlyMap<string, boolean> =>
  new Map(
    BRANCHES.filter((branch) => groups[branch].length > 0).flatMap((branch) => [
      [branch, isOpen(folds, branchToggle(branch))] as const,
      ...groups[branch].map(
        (group) => [group.key, isOpen(folds, turnToggle(group))] as const,
      ),
    ]),
  );

/**
 * A place j and k move the focus ring to: the element's key, and the prefix
 * every element of the same item shares, so a ring on any of them is there.
 */
export type Stop = Readonly<{ key: string; group: string }>;

/** A toggle's stop: its key, which no other element shares. */
const toggleStop = (key: string): Stop => ({ key, group: key });

/** The element an item's box opens its answers on: a Decide item's first option, by its letter, another list's first action, by its settling word; none for an item with neither. */
const firstAnswerOf = (item: ListedItem): string | undefined =>
  isDecide(item)
    ? item.options[0]?.letter
    : settlingWordsOf(paneListOf(item.list) ?? DECIDE)[0];

/** The key of an item's action, the button that writes `word` after its reference: `9efb08a1.Todo.3.done`. */
export const actionKey = (item: ListedItem, word: string): string =>
  `${refOf(item)}.${word}`;

/** An open or queued item's stop: its first option or action, else its notes field. */
const itemStop = (item: ListedItem): Stop => ({
  key: actionKey(item, firstAnswerOf(item) ?? "notes"),
  group: refOf(item),
});

/** A Done item's stop: its line, or its box's title. */
const doneStop = (item: ListedItem): Stop => ({
  key: lineKey(item),
  group: refOf(item),
});

/** The items a branch shows, as stops: each expanded turn's, in the pane's order. */
const itemStops = (
  groups: PaneGroups,
  folds: Folds,
  branch: Branch,
): readonly Stop[] =>
  isOpen(folds, branchToggle(branch))
    ? groups[branch]
        .filter((group) => isOpen(folds, turnToggle(group)))
        .flatMap((group) =>
          group.items.map(branch === "done" ? doneStop : itemStop),
        )
    : [];

/**
 * The stops j and k move between, in the pane's order: each branch with an
 * item, Open, Queued, then Done, its header and, while it's expanded, each
 * turn's header and, while that's expanded, each of its items' first
 * option, or a Done item's line. A collapsed group's items are no stops.
 */
export const paneStops = (
  groups: PaneGroups,
  folds: Folds,
): readonly Stop[] =>
  BRANCHES.filter((branch) => groups[branch].length > 0).flatMap((branch) => [
    toggleStop(branch),
    ...(isOpen(folds, branchToggle(branch))
      ? groups[branch].flatMap((group) => [
          toggleStop(group.key),
          ...(isOpen(folds, turnToggle(group))
            ? group.items.map(branch === "done" ? doneStop : itemStop)
            : []),
        ])
      : []),
  ]);

/**
 * Where the ring on `focused` goes once a pick or a note moves `item` out
 * of Open, from the groups before to those after: the next open item it
 * shows, its first option; else the last one before it; else the item
 * itself in its new branch, where that shows it. Undefined while the ring
 * is on another element, while the item is still in Open, or with nowhere
 * to go.
 */
export const ringAfterMove = (
  before: PaneGroups,
  after: PaneGroups,
  folds: Folds,
  item: ListedItem,
  focused: string,
): string | undefined => {
  const ref = refOf(item);
  const order = itemStops(before, folds, "open").map((stop) => stop.group);
  const at = order.indexOf(ref);
  const open = itemStops(after, folds, "open");
  const placed = (stop: Stop): number => order.indexOf(stop.group);

  return !focused.startsWith(`${ref}.`) ||
    at < 0 ||
    open.some((stop) => stop.group === ref)
    ? undefined
    : (open.find((stop) => placed(stop) > at) ??
        open.findLast((stop) => placed(stop) >= 0 && placed(stop) < at) ??
        BRANCHES.flatMap((branch) => itemStops(after, folds, branch)).find(
          (stop) => stop.group === ref,
        ))?.key;
};

/**
 * The stop the ring on `focused` is at: the one with that key; else the
 * one whose group is the longest prefix of it, so the innermost group
 * wins: an element keyed under `done.9efb08a1.` is at that turn's stop,
 * not at `done`, whose key starts it too; -1 for none.
 */
const stopAt = (stops: readonly Stop[], focused: string): number => {
  const exact = stops.findIndex((stop) => stop.key === focused);

  return exact >= 0
    ? exact
    : stops.reduce(
        (best, stop, at) =>
          focused.startsWith(`${stop.group}.`) &&
          (best < 0 || stop.group.length > (stops[best]?.group.length ?? 0))
            ? at
            : best,
        -1,
      );
};

/**
 * Where j (`step` 1) or k (-1) moves the ring from the element `focused`
 * names: the next or the previous stop; the first or the last when the ring
 * is on no stop; undefined past either end, or with no stops.
 */
export const steppedStop = (
  stops: readonly Stop[],
  focused: string,
  step: 1 | -1,
): string | undefined => {
  const at = stopAt(stops, focused);

  return at < 0
    ? (step > 0 ? stops[0] : stops.at(-1))?.key
    : stops[at + step]?.key;
};
