// Raised items for the tests: items raised open, and the refs of those
// settled, as the tests ask after them.

import { refOf } from "../../src/items/items.ts";
import type { ListedItem, Raised, RaisedItem } from "../../types/index.d.ts";

/** Each of `items` raised, open. */
export const openItems = (items: readonly ListedItem[]): readonly RaisedItem[] =>
  items.map((item) => ({ item, state: { tag: "open" } }));

/** The refs of the raised items settled, oldest first. */
export const settledRefsOf = (raised: Raised): readonly string[] =>
  raised.items
    .filter((each) => each.state.tag === "settled")
    .map((each) => refOf(each.item));
