// The items of the lists the pane draws that a reply's own list prints,
// where no `kanban_options` call raised them: Todo's, so far. Each is the
// item the facts the turns hold read from the reply, by turn, number, bold
// summary and the lines under it, and is settled by a settling word the
// spec gives its list, after its reference in a later prompt, `Todo.3:
// done`, a note after the word or not; by a later `reassess` turn; or,
// superseded, by a later item of its list on its subject. A note alone
// settles nothing. No `$`, no I/O.
//
// The 📌 roll-up and the count line read the same words, by Todo's
// `settled-by`, `settling-word`, in outstanding.ts, from the same facts.

import { factsOf, itemsOfText, subjectKey, summaryOf } from "./outstanding.ts";
import type { Facts, ListItem } from "./outstanding.ts";
import { latestWord } from "./word-answers.ts";
import type { HeldWordAnswer } from "./word-answers.ts";
import { TODO } from "../protocol/rules.ts";
import { SPEC } from "../protocol/spec.ts";
import type { Settlement, TodoItem, Turn } from "../../types/index.d.ts";

/** Whether a list item is a numbered item of a reply's own Todo list: not a 📌 roll-up's bullet. */
const isOwnTodo = (item: Omit<ListItem, "at">): boolean =>
  SPEC.lists[item.list] === TODO && !item.isPinned && item.number !== undefined;

/** The Todo item a list item is, by its turn's id. */
const todoItemOf = (turn: string, item: Omit<ListItem, "at">): TodoItem => ({
  turn,
  list: TODO.header,
  number: item.number ?? 0,
  summary: summaryOf(item.line),
  ref: `${turn}.${TODO.header}.${item.number ?? 0}`,
  ...(item.body === undefined ? {} : { note: item.body }),
  ...(item.frees.length > 0 ? { frees: item.frees } : {}),
});

/** The numbered items one reply text's own Todo lists print, in order, by the turn id `turn`, each freeing what its `Frees:` line names as written; a 📌 roll-up's bullets are none. */
export const todoItemsOfText = (text: string, turn: string): readonly TodoItem[] =>
  itemsOfText(text)
    .filter(isOwnTodo)
    .map((item) => todoItemOf(turn, item));

/** A Todo item a reply printed, and the place of its turn. */
type Printed = Readonly<{ item: TodoItem; at: number }>;

/** Every Todo item the facts hold, oldest first, each turn's items by number once, its last printing of each kept, in the order of first printing. */
const printedIn = (facts: Facts): readonly Printed[] => [
  ...new Map(
    facts.items
      .filter(isOwnTodo)
      .map((item) => [
        `${item.at}\t${item.number}`,
        { item: todoItemOf(facts.turns[item.at]?.id ?? "", item), at: item.at },
      ] as const),
  ).values(),
];

/** A Todo item a reply printed, and how it settled, if it did. */
export type TodoState = Readonly<{ item: TodoItem; settlement: Settlement | undefined }>;

/** How a Todo item stopped being open: by a settling word, a later `reassess` turn, or a later item on its subject, `by` its ref, superseding it; undefined while it's open. */
const settlementOf = (
  item: TodoItem,
  answer: HeldWordAnswer | undefined,
  isBeforeReassess: boolean,
  by: string | undefined,
): Settlement | undefined =>
  answer !== undefined
    ? { ref: item.ref, how: "worded", turn: answer.sent, word: answer.word, note: answer.note }
    : isBeforeReassess
      ? { ref: item.ref, how: "reassessed" }
      : by !== undefined
        ? { ref: item.ref, how: "superseded", by }
        : undefined;

/**
 * Every Todo item the replies printed, oldest first, and how it settled,
 * if it did: by the latest of the user's answers giving it a settling
 * word, else by a later `reassess` turn, else by the latest Todo item on
 * its subject since that turn, which supersedes it. A turn that reassesses
 * applies its own answers first, so an item it answers settles by its word.
 */
export const todoStatesIn = (facts: Facts): readonly TodoState[] => {
  const printed = printedIn(facts);
  const last = new Map(
    printed
      .map(({ item, at }, n) => ({ key: subjectKey(item.summary), at, n }))
      .filter(({ at }) => at >= facts.start)
      .map(({ key, n }) => [key, n] as const),
  );

  /** The ref of the latest item on the subject of printing `n`, where that's a later one. */
  const supersededBy = (n: number, summary: string): string | undefined => {
    const latest = last.get(subjectKey(summary));

    return latest === undefined || latest === n ? undefined : printed[latest]?.item.ref;
  };

  return printed.map(({ item, at }, n) => ({
    item,
    settlement: settlementOf(
      item,
      latestWord(facts.words, TODO.header, item.turn, at, item.number),
      at < facts.start,
      supersededBy(n, item.summary),
    ),
  }));
};

/** todoStatesIn, over the facts the turns hold. */
export const todoStates = (turns: readonly Turn[]): readonly TodoState[] =>
  todoStatesIn(factsOf(turns));

/**
 * The subject keys of the Todo items a settling word settled, each as its
 * subject's latest printing in its own list, read from the items' states:
 * the 📌 roll-up's `settling-word` reads the same from the facts directly,
 * and the differential test holds the two to one answer.
 */
export const wordedSubjects = (turns: readonly Turn[]): ReadonlySet<string> => {
  const latest = new Map(
    todoStates(turns).map((state) => [subjectKey(state.item.summary), state] as const),
  );

  return new Set(
    [...latest].flatMap(([key, state]) => (state.settlement?.how === "worded" ? [key] : [])),
  );
};

/** What the turns leave open of the Todo items: those open, oldest first, and how each settled one settled. */
export type OpenTodo = Readonly<{
  items: readonly TodoItem[];
  settlements: readonly Settlement[];
}>;

/** The open Todo items and the settlements, from one reading of the items' states, over the facts the turns hold. */
export const openTodoIn = (facts: Facts): OpenTodo => {
  const states = todoStatesIn(facts);

  return {
    items: states.filter((state) => state.settlement === undefined).map((state) => state.item),
    settlements: states.flatMap((state) => state.settlement ?? []),
  };
};

/** openTodoIn, over the facts the turns hold. */
export const openTodoOf = (turns: readonly Turn[]): OpenTodo => openTodoIn(factsOf(turns));
