// Whether a report names a Waiting item, by the names an adapter read the
// report to go by: the kanban skill's `report_names_item`, in TypeScript.
// And a pseudo-XML reader, `elements`, which the Claude Code adapter reads
// its reports' names with. No `$`, no I/O.

import { escaped } from "../text/patterns.ts";

/** One element of a pseudo-XML text: its tag and attributes, lowercased names, and its own text, no child's. */
export type Element = Readonly<{
  tag: string;
  attrs: Readonly<Record<string, string>>;
  text: string;
}>;

// A start tag with its attributes, or an end tag. Text, unlike XML, may hold
// a bare `&` or `<`, so anything else is read as text.
const TAG =
  /<\/([a-zA-Z][^\s/>]*)\s*>|<([a-zA-Z][^\s/>]*)((?:\s+[^\s/>=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const ATTR =
  /([^\s/>=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const ENTITY = /&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|(amp|lt|gt|quot|apos));/g;
const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** The text with its character references made characters. */
const unescaped = (text: string): string =>
  text.replace(ENTITY, (_, dec?: string, hex?: string, name?: string) =>
    dec !== undefined
      ? String.fromCodePoint(Number(dec))
      : hex !== undefined
        ? String.fromCodePoint(parseInt(hex, 16))
        : (NAMED_ENTITIES[name ?? ""] ?? ""),
  );

const attrsOf = (text: string): Readonly<Record<string, string>> =>
  Object.fromEntries(
    [...text.matchAll(ATTR)].map((m) => [
      (m[1] ?? "").toLowerCase(),
      unescaped(m[2] ?? m[3] ?? m[4] ?? ""),
    ]),
  );

/**
 * What a one-pass parse keeps: each new entry put on top, in constant time,
 * so a text with many tags parses in time linear in them.
 */
type Stack<T> = Readonly<{ top: T; below: Stack<T> }> | undefined;

/** Each node of a stack, the top first. */
function* nodes<T>(stack: Stack<T>): Generator<NonNullable<Stack<T>>> {
  for (let node = stack; node !== undefined; node = node.below) {
    yield node;
  }
}

/** A stack's entries, the bottom first: the order they were put on. */
const bottomFirst = <T>(stack: Stack<T>): readonly T[] =>
  [...nodes(stack)].map((node) => node.top).toReversed();

/** An element opened: its place among the elements, and its tag. */
type Opened = Readonly<{ at: number; tag: string }>;

type Parse = Readonly<{
  /** Every element opened, each with its tag and attributes, the latest on top. */
  found: Stack<Readonly<{ tag: string; attrs: Element["attrs"] }>>;
  count: number;
  /** The elements still open, the innermost on top. */
  open: Stack<Opened>;
  /** Each piece of text, with the element whose own text it is, the latest on top. */
  parts: Stack<Readonly<{ at: number; data: string }>>;
}>;

/** The parse with `data` added to the innermost open element's own text. */
const withData = (state: Parse, data: string): Parse =>
  data === "" || state.open === undefined
    ? state
    : {
        ...state,
        parts: { top: { at: state.open.top.at, data }, below: state.parts },
      };

/** The first node from the top whose entry `isIt`, read no further down than it. */
const nodeWhere = <T>(
  stack: Stack<T>,
  isIt: (entry: T) => boolean,
): NonNullable<Stack<T>> | undefined => {
  for (const node of nodes(stack)) {
    if (isIt(node.top)) {
      return node;
    }
  }

  return undefined;
};

/** The open elements once the innermost open one tagged `tag` closes, with every one inside it; as they are when none is open. */
const closing = (open: Stack<Opened>, tag: string): Stack<Opened> => {
  const match = nodeWhere(open, (opened) => opened.tag === tag);

  return match === undefined ? open : match.below;
};

const withTag = (state: Parse, m: RegExpMatchArray): Parse => {
  const closed = m[1]?.toLowerCase();
  const tag = (m[2] ?? "").toLowerCase();

  return closed !== undefined
    ? { ...state, open: closing(state.open, closed) }
    : {
        found: { top: { tag, attrs: attrsOf(m[3] ?? "") }, below: state.found },
        count: state.count + 1,
        open:
          m[4] === "/"
            ? state.open
            : { top: { at: state.count, tag }, below: state.open },
        parts: state.parts,
      };
};

/** Each element's own text, by its place: its pieces joined, in order. */
const ownTexts = (
  parts: readonly Readonly<{ at: number; data: string }>[],
): ReadonlyMap<number, string> => {
  const byElement = parts.toSorted((a, b) => a.at - b.at);
  const starts = byElement.flatMap((part, n) =>
    byElement[n - 1]?.at === part.at ? [] : [n],
  );

  return new Map(
    starts.map((start, run) => {
      const pieces = byElement.slice(start, starts[run + 1]);

      return [pieces[0]?.at ?? -1, pieces.map((piece) => piece.data).join("")];
    }),
  );
};

/** Each element of a pseudo-XML text, in order, each with its own text, trimmed. */
export const elements = (text: string): readonly Element[] => {
  const tags = [...text.matchAll(TAG)];
  const ends = tags.map((m) => (m.index ?? 0) + m[0].length);
  const parsed = tags.reduce(
    (state, m, n) =>
      withTag(
        withData(state, unescaped(text.slice(ends[n - 1] ?? 0, m.index ?? 0))),
        m,
      ),
    { found: undefined, count: 0, open: undefined, parts: undefined } as Parse,
  );
  const done = withData(parsed, unescaped(text.slice(ends.at(-1) ?? 0)));
  const texts = ownTexts(bottomFirst(done.parts));

  return bottomFirst(done.found).map(({ tag, attrs }, at) => ({
    tag,
    attrs,
    text: (texts.get(at) ?? "").trim(),
  }));
};

/** Whether `text` holds `name` as a whole word, ignoring case; a word may hold hyphens, as a branch name does. */
export const namesWord = (name: string, text: string): boolean =>
  name.trim() !== "" &&
  new RegExp(
    String.raw`(?<![\p{L}\p{N}_-])${escaped(name)}(?![\p{L}\p{N}_-])`,
    "iu",
  ).test(text);

const SPAN = /`([^`]+)`/g;
const BRANCH = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;

/** The text's code spans shaped like a branch name, lowercase words joined by hyphens, in order. */
export const branchSpans = (text: string): readonly string[] =>
  [...text.matchAll(SPAN)]
    .map((m) => m[1] ?? "")
    .filter((span) => BRANCH.test(span));

/**
 * Whether a report names a Waiting item: the item's summary holds one of the
 * report's names, or the report holds a code span of the summary shaped like
 * a branch name.
 */
export const reportNamesItem = (
  summary: string,
  names: readonly string[],
  report: string,
): boolean =>
  names.some((name) => namesWord(name, summary)) ||
  branchSpans(summary).some((branch) => namesWord(branch, report));
