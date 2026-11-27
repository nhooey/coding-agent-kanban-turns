// Raised items for the tests: items raised open, the refs of those
// settled, and those answered by options, as the tests ask after them.

import { hasOptions, refOf } from "../../src/items/items.ts";
import { listedItemsOf } from "../../src/items/raised.ts";
import type { DecideItem, ListedItem, Raised, RaisedItem } from "../../types/index.d.ts";

/** Each of `items` raised, open. */
export const openItems = (items: readonly ListedItem[]): readonly RaisedItem[] =>
  items.map((item) => ({ item, state: { tag: "open" } }));

/** The refs of the raised items settled, oldest first. */
export const settledRefsOf = (raised: Raised): readonly string[] =>
  raised.items
    .filter((each) => each.state.tag === "settled")
    .map((each) => refOf(each.item));

/** The raised items answered by options, oldest first, settled or open. */
export const optionItemsOf = (raised: Raised): readonly DecideItem[] =>
  listedItemsOf(raised).filter(hasOptions);
