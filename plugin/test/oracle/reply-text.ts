// The differential test's oracle for the readers of a reply's text: the
// functions that each scanned its lines again, as they stood at 6fa0de6,
// before `parseReply` read the text once into blocks. They are
// `sectionsOf` of src/transcript/turns.ts, `itemsOfText` and
// `decideItemsOfText` of src/items/outstanding.ts, `decideListCut` and
// `linkedQuestions` of src/pane/links.ts, and `isKanbanReply` of
// src/lint/reply.ts. test/unit/transcript/reply-differential.test.ts
// compares the core against them. The helpers they share with the core,
// which reading the text once changed nothing of, are imported from it.
//
// Temporary: the oracle and its test are deleted once
// `reply-text-parse-once` has merged into `master`.

import { freesOfLine, isFreesLine } from "../../src/items/frees.ts";
import { refOf } from "../../src/items/items.ts";
import { LIST_KEYS, SEPARATOR } from "../../src/items/outstanding.ts";
import type { ListItem, ListKey } from "../../src/items/outstanding.ts";
import { optionGlyphs } from "../../src/protocol/kinds.ts";
import {
  DECIDE,
  LETTER,
  SUBSCRIPT_CHAR,
  TURN_ID,
  isLineOf,
  namesOf,
} from "../../src/protocol/rules.ts";
import { SPEC } from "../../src/protocol/spec.ts";
import { escaped } from "../../src/text/patterns.ts";
import type { DecideItem } from "../../types/index.d.ts";

// src/transcript/turns.ts

/** One section of a reply: its list's name as the header writes it, and its text, the header first. */
export type Section = Readonly<{ name: string; text: string }>;

const SECTION_NAMES: readonly string[] =
  Object.values(SPEC.lists).flatMap(namesOf);

const DECISIONS: readonly string[] = namesOf(DECIDE);

const HEADER = new RegExp(
  String.raw`^\s*\S+\s+\*\*(${SECTION_NAMES.map(escaped).join("|")}):\*\*`,
);
const STOPS: readonly string[] = SPEC["roll-up"].aliases;
const TOPIC_RULE = SPEC.characters["topic-underline"];

const isTopicRule = (line: string): boolean => isLineOf(TOPIC_RULE, line);

type Fold = Readonly<{
  open: string | undefined;
  done: readonly Readonly<{ name: string; lines: readonly string[] }>[];
}>;

const fold = (
  { open, done }: Fold,
  [line, following]: readonly [string, string],
): Fold => {
  const header = HEADER.exec(line)?.[1];

  return header !== undefined
    ? { open: header, done: [...done, { name: header, lines: [line] }] }
    : STOPS.some((stop) => line.startsWith(stop)) ||
        isTopicRule(line) ||
        isTopicRule(following)
      ? { open: undefined, done }
      : open !== undefined
        ? {
            open,
            done: done.map((section, n) =>
              n === done.length - 1
                ? { ...section, lines: [...section.lines, line] }
                : section,
            ),
          }
        : { open, done };
};

export const sectionsOf = (text: string): readonly Section[] => {
  const lines = text.split("\n");
  const pairs = lines.map(
    (line, n) => [line, lines[n + 1] ?? ""] as const,
  );

  return pairs
    .reduce(fold, { open: undefined, done: [] } as Fold)
    .done.map(({ name, lines: own }) => ({
      name,
      text: own.join("\n").trimEnd(),
    }));
};

// src/items/outstanding.ts

const keyOfName = (name: string): ListKey | undefined =>
  LIST_KEYS.find((key) => namesOf(SPEC.lists[key]).includes(name));

const ROLL_UP = SPEC["roll-up"];

export const PIN = new RegExp(
  String.raw`^\s*${escaped(ROLL_UP.glyph)}\s+\*\*(${namesOf(ROLL_UP).map(escaped).join("|")}):\*\*`,
  "u",
);
const ITEM = /^ {0,2}(?:[-*]|(\d+)[.)])\s+(.*)$/;
const TAG = escaped(SPEC.tag.glyph);
const SUFFIX = new RegExp(
  String.raw`\s*${TAG}\s+(${TURN_ID})${SUBSCRIPT_CHAR}*\s*$`,
  "u",
);

const awaitsBody = (text: string): boolean => {
  const bold = /^\*\*(.+?)\*\*/.exec(text);

  return bold !== null && text.slice(bold[0].length).trim() === "";
};

type Found = Readonly<{
  list: ListKey;
  number: number | undefined;
  isPinned: boolean;
  line: string;
  last: string | undefined;
}>;

type Scan = Readonly<{
  list: ListKey | undefined;
  isPinned: boolean;
  found: readonly Found[];
  isAwaiting: boolean;
  isInItem: boolean;
  fence: string;
}>;

const FENCES: readonly string[] = ["```", "~~~"];

const fenceOf = (body: string): string =>
  FENCES.find((fence) => body.startsWith(fence)) ?? "";

const underItem = (state: Scan, last: Found, body: string): Scan => ({
  ...state,
  found: [
    ...state.found.slice(0, -1),
    {
      ...last,
      line:
        state.isAwaiting && !isFreesLine(body)
          ? `${last.line} ${body}`
          : last.line,
      last: state.isInItem ? body : last.last,
    },
  ],
  isAwaiting: false,
  fence: !state.isInItem
    ? ""
    : state.fence === ""
      ? fenceOf(body)
      : fenceOf(body) === state.fence
        ? ""
        : state.fence,
});

const scan = (state: Scan, line: string): Scan => {
  const header = HEADER.exec(line)?.[1];
  const item = ITEM.exec(line);
  const body = line.trim();
  const last = state.found.at(-1);
  const ended = { isAwaiting: false, isInItem: false, fence: "" };

  return state.fence !== "" && last !== undefined
    ? underItem(state, last, body)
    : header !== undefined
    ? { ...state, ...ended, list: keyOfName(header) }
    : PIN.test(line)
      ? { ...state, ...ended, list: undefined, isPinned: true }
      : isTopicRule(line)
        ? { ...state, ...ended, list: undefined }
        : body === ""
          ? { ...state, ...ended }
          : state.list !== undefined && item !== null
            ? {
                ...state,
                found: [
                  ...state.found,
                  {
                    list: state.list,
                    number: item[1] === undefined ? undefined : Number(item[1]),
                    isPinned: state.isPinned,
                    line: (item[2] ?? "").trim(),
                    last: undefined,
                  },
                ],
                isAwaiting: awaitsBody((item[2] ?? "").trim()),
                isInItem: true,
              }
            : body === SEPARATOR
              ? { ...state, isInItem: false }
              : last !== undefined && (state.isAwaiting || state.isInItem)
                ? underItem(state, last, body)
                : state;
};

export const itemsOfText = (text: string): readonly Omit<ListItem, "at">[] =>
  text
    .split("\n")
    .reduce(scan, {
      list: undefined,
      isPinned: false,
      found: [],
      isAwaiting: false,
      isInItem: false,
      fence: "",
    } as Scan)
    .found.map(({ last, ...found }) => {
      const tagged = SUFFIX.exec(found.line)?.[1];

      return {
        ...found,
        line: found.line.replace(SUFFIX, ""),
        frees: freesOfLine(last ?? "") ?? [],
        ...(tagged === undefined ? {} : { tagged }),
      };
    });

const DECIDE_ITEM = /^ {0,3}(\d+)[.)]\s+\*\*(.+?)\*\*/gm;
const OPTION_GLYPHS = optionGlyphs(SPEC.options.kinds);
const DECIDE_OPTION = new RegExp(
  String.raw`^\s*(?:${OPTION_GLYPHS.map(escaped).join("|")})\s+${LETTER}\.\s+\*\*.+?\*\*`,
  "mu",
);

export const decideItemsOfText = (
  text: string,
): readonly Readonly<{ number: number; summary: string }>[] =>
  sectionsOf(text)
    .filter((section) => DECISIONS.includes(section.name))
    .flatMap(({ text: body }) => {
      const heads = [...body.matchAll(DECIDE_ITEM)];

      return heads
        .map((head, n) => ({
          head,
          chunk: body.slice(head.index, heads[n + 1]?.index ?? body.length),
        }))
        .filter(({ chunk }) => DECIDE_OPTION.test(chunk))
        .map(({ head }) => ({
          number: Number(head[1]),
          summary: (head[2] ?? "").trim().replace(/:$/, "").trim(),
        }));
    });

// src/pane/links.ts

const QUESTION_LINK = "https://kanban-turns.invalid/";

const SUMMARY_LINE = /^(\s*\d+\.\s+)\*\*(.+?)\*\*([ \t]*)$/gm;

const plainSummary = (summary: string): string =>
  summary.replaceAll("**", "").replaceAll("`", "").trim();

export const linkedQuestions = (
  text: string,
  items: readonly DecideItem[],
): Readonly<{ text: string; hrefs: readonly string[] }> => {
  const bySummary = new Map(
    items.map((item) => [plainSummary(item.summary), item]),
  );
  const hrefOf = (summary: string): string | undefined => {
    const item = bySummary.get(plainSummary(summary));

    return item === undefined ? undefined : `${QUESTION_LINK}${refOf(item)}`;
  };

  return {
    text: text.replace(
      SUMMARY_LINE,
      (line, lead: string, summary: string, tail: string) => {
        const href = hrefOf(summary);

        return href === undefined
          ? line
          : `${lead}**[${summary}](${href})**${tail}`;
      },
    ),
    hrefs: [...text.matchAll(SUMMARY_LINE)]
      .map((m) => hrefOf(m[2] ?? ""))
      .filter((href) => href !== undefined),
  };
};

const SUMMARY_ONE = /^(\d+\.\s+)\*\*(.+?)\*\*([ \t]*)$/;

const OPTION = new RegExp(String.raw`(?:^|\s)(${LETTER})\.\s+\*\*(.+?)\*\*`);

const optionsIn = (block: readonly string[]): readonly string[] =>
  block.flatMap((line) => {
    const found = OPTION.exec(line);

    return found === null ? [] : [`${found[1]}. ${plainSummary(found[2] ?? "")}`];
  });

const hasOptionsOf = (item: DecideItem, block: readonly string[]): boolean => {
  const written = optionsIn(block);

  return item.options.every((option) =>
    written.includes(`${option.letter}. ${plainSummary(option.name)}`),
  );
};

const isUnderline = (line: string): boolean =>
  isLineOf(SPEC.characters["header-underline"], line);

const endsList = (line: string, following: string): boolean =>
  line.trim() === "" ||
  HEADER.test(line) ||
  PIN.test(line) ||
  isTopicRule(line) ||
  isTopicRule(following) ||
  (/^\S/.test(line) && !SUMMARY_ONE.test(line) && !isUnderline(line));

const isDecideHeader = (line: string): boolean =>
  DECISIONS.includes(HEADER.exec(line)?.[1] ?? "");

export const decideListCut = (
  text: string,
  items: readonly DecideItem[],
): Readonly<{ before: string; after: string }> | undefined => {
  const lines = text.split("\n");
  const pinned = lines.findIndex((line) => PIN.test(line));
  const ownLines = pinned < 0 ? lines : lines.slice(0, pinned);
  const headers = ownLines.flatMap((line, n) =>
    isDecideHeader(line) ? [n] : [],
  );
  const start = headers.length === 1 ? (headers[0] ?? -1) : -1;
  const length = lines
    .slice(start + 1)
    .findIndex((line, n) => endsList(line, lines[start + n + 2] ?? ""));
  const end = length < 0 ? lines.length : start + 1 + length;
  const list = lines.slice(start + 1, end);
  const starts = list.flatMap((line, n) =>
    SUMMARY_ONE.test(line) ? [n] : [],
  );
  const blocks = starts.map((at, n) => list.slice(at, starts[n + 1]));
  const isIntact =
    start >= 0 &&
    items.length > 0 &&
    blocks.length === items.length &&
    items.every((item, n) => {
      const block = blocks[n] ?? [];
      const summary = SUMMARY_ONE.exec(block[0] ?? "")?.[2] ?? "";

      return (
        plainSummary(item.summary) === plainSummary(summary) &&
        hasOptionsOf(item, block)
      );
    });

  return isIntact
    ? {
        before: lines.slice(0, start).join("\n").trim(),
        after: lines.slice(end).join("\n").trim(),
      }
    : undefined;
};

// src/lint/reply.ts

export const isKanbanReply = (text: string): boolean =>
  text
    .split("\n")
    .some(
      (line) =>
        HEADER.test(line) ||
        PIN.test(line) ||
        line.trimStart().startsWith(`${ROLL_UP.glyph} ${ROLL_UP["count-label"]}:`),
    );
