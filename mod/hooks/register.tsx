// Clickable answers to the kanban turn responses' Decide items: a pane that
// lists every item raised in the session, oldest first, newest at the
// bottom, each in its own box, and the same boxes under the reply that
// raised them. The pane opens by itself, without the keyboard, at session
// start when items are open and when a reply raises a new one; the skill's
// count line above the prompt, with a 🪟 ↗ button, and /answers open it
// with the keyboard. A click writes the item's reference, on a line of its
// own, into the prompt draft and never sends it; Reassess alone sends a
// prompt, the skill's `reassess` command. A settled item stays, dimmed, its
// buttons dead.
//
// An item is drawn as the skill writes it: its summary, its note, then each
// option as `glyph letter. name: consequence` with its ➕ and ➖ lines indented
// under it, inside a rounded border. Only the option the draft picks gets a
// background; a bar in the column left of an option lights under the pointer.

import { atom, read, update } from "claude-code";
import type { EngineInterface, Register, RenderNode } from "claude-code";

import { choose, lettersFor, noteFor, withNote } from "../src/answers.ts";
import {
  INPUT_SCHEMA,
  TOOL,
  TOOL_CALLED,
  TOOL_DESCRIPTION,
  withInstructions,
} from "../src/instructions.ts";
import { glyphOf, itemsOf, refOf } from "../src/items.ts";
import { countsArgv, countsOf } from "../src/counts.ts";
import { INDENT, codeSpans } from "../src/layout.ts";
import { itemOfLink, linkedItems, linkedQuestions } from "../src/links.ts";
import {
  NOTHING,
  failedRun,
  foundFrom,
  missingScript,
  outstandingArgv,
  scriptPath,
  withProblems,
} from "../src/outstanding.ts";
import type { Found } from "../src/outstanding.ts";
import {
  emptyRaised,
  firstUnanswered,
  forSession,
  isSettled,
  refreshed,
  seen,
  unseen,
  withItems,
} from "../src/raised.ts";
import {
  answersText,
  configText,
  drewText,
  isPlainToolRow,
  itemTitle,
  noItemsText,
} from "../src/view.ts";
import type {
  DecideItem,
  Loaded,
  Raised,
  Settings,
} from "../types/index.d.ts";
import { loadSettings } from "./settings.ts";

const REASSESS = "reassess";
// The pane that lists the items, and its title. The hotkey and colours are
// settings, in defaults/config.jsonc.
const PANE = { id: "kanban-turns", title: "🧠 Decide" } as const;
// The column left of an option's lines that lights while the pointer is over
// the option: it comes out of the option's indent, so its text stays put.
const GUTTER = 1;
// Nothing read yet: no settings until session.start reads the files.
const UNREAD: Loaded = { settings: null, effective: [], problems: [] };

// Change the tag when Raised's fields change: it declines what an earlier
// version stored, which outlives a reload.
const raised = atom(
  { plugin: "coding-agent-kanban-turns", key: "raised" } as const,
  emptyRaised,
  { shape: "raised-1" },
);
const draft = atom(
  { plugin: "coding-agent-kanban-turns", key: "draft" } as const,
  "",
);
// The skill's count line, `📌 Outstanding: 🚧 2 · … · 🧠 3`, from the last
// refresh; empty when the script gave none.
const counts = atom(
  { plugin: "coding-agent-kanban-turns", key: "counts" } as const,
  "",
);
const settings = atom(
  { plugin: "coding-agent-kanban-turns", key: "settings" } as const,
  UNREAD,
  { shape: "settings-1" },
);

/** The settings in effect, or none while the defaults file can't be used. */
const settingsNow = async ($: EngineInterface): Promise<Settings | null> =>
  (await read($, settings)).settings;

/** Runs `outstanding.py decide --json` over this session's transcript, as `outstanding` sets it: the open items, or why there are none. */
const openItems = async (
  $: EngineInterface,
  outstanding: Settings["outstanding"],
): Promise<Found> => {
  const home = await $.env.get("HOME");
  const script = scriptPath(outstanding, home);

  return (await $.fs.exists(script))
    ? foundFrom(
        await $.process.run(
          outstandingArgv(outstanding, home, await $.session.id()),
          { cwd: await $.session.cwd(), timeoutMs: outstanding["timeout-ms"] },
        ),
      )
    : missingScript(script);
};

/** Runs `outstanding.py render --counts` over this session's transcript: the skill's count line, or none. */
const countLine = async (
  $: EngineInterface,
  outstanding: Settings["outstanding"],
): Promise<string> => {
  const script = scriptPath(outstanding, await $.env.get("HOME"));

  return (await $.fs.exists(script))
    ? countsOf(
        await $.process.run(
          countsArgv(outstanding.python, script, await $.session.id()),
          {
            cwd: await $.session.cwd(),
            timeoutMs: outstanding["timeout-ms"],
          },
        ),
      )
    : "";
};

/** The open items, or why there are none: the settings' problems first, then the script's. */
const found = async ($: EngineInterface): Promise<Found> => {
  const { settings: s, problems } = await read($, settings);

  return withProblems(
    problems,
    s === null ? NOTHING : await openItems($, s.outstanding).catch(failedRun),
  );
};

/** Reads the settings files again, so an edit to either is taken up at the next refresh. */
const reloadSettings = async ($: EngineInterface): Promise<Loaded> => {
  const now = await loadSettings($).catch(
    (error: unknown): Loaded => ({ ...UNREAD, problems: [String(error)] }),
  );
  await update($, settings, () => now);

  return now;
};

/** Reads the settings, the open items and the count line again: open items join the raised ones, and raised ones no longer open settle. */
const refresh = async ($: EngineInterface): Promise<void> => {
  const { settings: s } = await reloadSettings($);
  const [open, line] = await Promise.all([
    found($),
    s === null ? "" : countLine($, s.outstanding).catch(() => ""),
  ]);
  await update($, counts, () => line);
  await update($, raised, (r) => refreshed(r, open.items, open.problem));
};

/** Rewrites the prompt draft with `edit`: the one way a click or a note reaches the draft. */
const rewriteDraft = async (
  $: EngineInterface,
  edit: (text: string) => string,
): Promise<void> => {
  const box = await $.prompt.read();
  const text = edit(box.text);
  await $.prompt.fill({ text, mode: "replace" });
  await update($, draft, () => text);
};

/** Writes the draft with the item's answer for `letter`. */
const answer = ($: EngineInterface, item: DecideItem, letter: string) =>
  rewriteDraft($, (text) => choose(text, item, letter));

/** Writes the item's note into the draft, on a line of its own. */
const note = ($: EngineInterface, item: DecideItem, said: string) =>
  rewriteDraft($, (text) => withNote(text, item, said));

/** Opens the pane: with the keyboard in it when the person asked for it, else beside the prompt, which keeps the keys. */
const openPane = ($: EngineInterface, isAsked: boolean) =>
  $.ui.open({ ...PANE, ...(isAsked ? { focus: true as const } : {}) });

/** Scrolls the pane to `to`, an item's box by its ref or its end; a pane not drawn yet stays as it is. */
const reveal = async (
  $: EngineInterface,
  to: { key: string } | "end",
): Promise<void> => {
  await $.ui
    .scroll({ in: PANE.id, to, block: "start" })
    .catch(() => undefined);
};

/** The end of a main-loop turn, or the session's start: opens the pane at its end when an item is open that the pane hasn't been opened over. */
const announce = async ($: EngineInterface): Promise<void> => {
  const r = await read($, raised);
  await update($, raised, seen);

  if (unseen(r).length > 0) {
    await openPane($, false);
    await reveal($, "end");
  }
};

/** /answers: re-reads the open items and opens the pane with the keyboard, at the first item the draft doesn't answer. */
const reopen = async ($: EngineInterface): Promise<Raised> => {
  await refresh($);
  await update($, raised, seen);
  await openPane($, true);
  const r = await read($, raised);
  const item = firstUnanswered(r, await read($, draft));

  if (item !== undefined) {
    await reveal($, { key: refOf(item) });
  }

  return r;
};

/** A question's link pressed: the pane, with the keyboard, scrolled to its item. */
const showItem = async ($: EngineInterface, href: string): Promise<void> => {
  const r = await read($, raised);
  const item = r.items[itemOfLink(r.items, href)];
  await openPane($, true);

  if (item !== undefined) {
    await reveal($, { key: refOf(item) });
  }
};

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    const started = await next(e);
    await $.command.register({
      name: "answers",
      description:
        "Open the kanban Decide pane, at the first unanswered item",
    });
    await $.command.register({
      name: "answers-config",
      description:
        "List the kanban turns mod's settings in effect, and the file each came from",
    });
    await $.tool.register({
      name: TOOL,
      description: TOOL_DESCRIPTION,
      isDeferred: false,
      inputSchema: INPUT_SCHEMA,
    });
    const session = await $.session.id();
    await update($, raised, (r) => forSession(r, session));
    void refresh($)
      .then(() => announce($))
      .catch(() => undefined);

    return started;
  });

  // The mod tells the agent about its tool itself: the instructions go in the
  // conversation's context, after whatever the engine and other hooks put there.
  on("prompt.context", async ($, e, next) => withInstructions(await next(e)));

  on("command.run", { command: "answers-config" }, async ($) => {
    const { effective, problems } = await reloadSettings($);

    return { text: configText(effective, problems) };
  });

  on("command.run", { command: "answers" }, async ($) => ({
    text: answersText(await reopen($)),
  }));

  on("tool.call", { tool: TOOL_CALLED }, async ($, e) => {
    const items = itemsOf(e);
    await update($, raised, (r) => withItems(r, items));

    return { result: drewText(items) };
  }).catch(() => ({
    result: "The buttons could not be drawn; the reply reads as before.",
  }));

  on("turn.complete", async ($, e, next) => {
    const done = await next(e);

    if (e.agentId === undefined) {
      await refresh($);
      await announce($);
    }

    return done;
  });

  on("prompt.change", async ($, e, next) => {
    const changed = await next(e);
    await update($, draft, () => e.text);

    return changed;
  });

  // Above the prompt: the skill's count line, then 🪟 ↗, both opening the
  // pane with the keyboard. Nothing when the script gives no line. Claude
  // Code stacks each plugin's drawing here itself, so another plugin's band,
  // such as the usage mod's agents tree, is drawn beside this one.
  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const s = await settingsNow($);
    const line = await read($, counts);

    if (e.props.hasSurvey || s === null || line === "") {
      return next(e);
    }

    const { Box, Button, Text } = $.ui.resolve(e);
    const open = () => openPane($, true);

    return (
      <Box columnGap={1}>
        <Button key="counts" label={line} plain dimColor onPress={open}>
          {line}
        </Button>
        <Button key="open-pane" label="Open the Decide pane" plain onPress={open}>
          🪟 <Text color={s.colors.expand}>↗</Text>
        </Button>
      </Box>
    );
  });

  // A reply's Decide questions: each raised item's summary line becomes a
  // link that opens the pane at that item, and the items the reply names are
  // drawn under it, each in its box.
  on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
    const r = await read($, raised);
    const linked = linkedQuestions(e.props.text, r.items);

    if (linked.hrefs.length === 0) {
      return next(e);
    }

    const s = await settingsNow($);
    const elements = $.ui.resolve(e);
    const { Box, Markdown } = elements;

    return (
      <Box flexDirection="column">
        <Markdown
          key="kanban-questions"
          text={linked.text}
          pressableLinks={linked.hrefs}
          onLinkPress={(link) => showItem($, link.href)}
        />
        {s === null
          ? null
          : itemBoxes(
              $,
              elements,
              s,
              r,
              linkedItems(r.items, linked.hrefs),
              await read($, draft),
            )}
      </Box>
    );
  });

  // The pane: Reassess and ❌ on top, then every raised item, oldest first.
  on("ui.render", { component: "Pane", requestId: PANE.id }, async ($, e) => {
    const r = await read($, raised);
    const elements = $.ui.resolve(e);
    const { Box, Button, Text } = elements;
    const s = await settingsNow($);

    if (r.items.length === 0 || s === null) {
      return <Text dimColor>{noItemsText(r.problem)}</Text>;
    }

    return (
      <Box flexDirection="column">
        <Box marginBottom={1} columnGap={2}>
          <Button
            key="reassess"
            label="Reassess"
            plain
            dimColor
            onPress={() => $.prompt.submit({ text: REASSESS })}
          >
            🔄 <Text underline>Reassess</Text>
          </Button>
          <Button
            key="dismiss"
            label="❌"
            plain
            dimColor
            role="dismiss"
            hotkey={s.keys.dismiss}
            onPress={() => $.ui.close({ id: PANE.id })}
          />
        </Box>
        {r.problem ? <Text dimColor>{r.problem}</Text> : null}
        {itemBoxes($, elements, s, r, r.items, await read($, draft))}
      </Box>
    );
  });

  // Where the engine draws the result apart from the call's row, such as the
  // view after a compaction, the result line repeats the call: keep it for
  // ctrl+o and for an error only.
  on("ui.render", { component: "ToolResult" }, async ($, e, next) => {
    if (
      e.props.tool !== TOOL_CALLED ||
      !isPlainToolRow({
        isExpanded: e.props.isExpanded,
        isErrored: e.props.isErrored,
      })
    ) {
      return next(e);
    }
    const { Box } = $.ui.resolve(e);

    return <Box />;
  });

  // The call's row comes before the reply, and its items are drawn under the
  // reply instead, so the row draws nothing. Keep the engine's row only where
  // it says more: ctrl+o, an error, an interrupted call, or a call that drew
  // no items.
  on("ui.render", { component: "ToolUse" }, async ($, e, next) => {
    if (
      e.props.tool !== TOOL_CALLED ||
      !isPlainToolRow({
        isExpanded: e.props.isExpanded,
        isErrored: e.props.isErrored,
        isInterrupted: e.props.isInterrupted,
        itemCount: itemsOf(e.props.input).length,
      })
    ) {
      return next(e);
    }
    const { Box } = $.ui.resolve(e);

    return <Box />;
  });
};

/** The elements an item is drawn with, from the surface's table. */
type Elements = Pick<
  ReturnType<EngineInterface["ui"]["resolve"]>,
  "Box" | "Button" | "Text" | "Input"
>;

/** Each item in its own rounded box, keyed by its ref, a settled one dimmed with its buttons dead: the pane's drawing and a reply's alike. */
const itemBoxes = (
  $: EngineInterface,
  elements: Elements,
  s: Settings,
  r: Raised,
  items: readonly DecideItem[],
  text: string,
) => {
  const { Box } = elements;

  return (
    <Box key="kanban-items" flexDirection="column">
      {items.map((item) => {
        const isDone = isSettled(r, item);

        return (
          <Box
            key={refOf(item)}
            flexDirection="column"
            borderStyle="round"
            borderColor={s.colors.border}
            borderDimColor={isDone}
            paddingX={1}
          >
            {itemView(elements, s.colors, item, {
              title: itemTitle(item, isDone),
              chosen: isDone ? [] : lettersFor(text, item),
              note: isDone ? "" : noteFor(text, item),
              isSettled: isDone,
              keyOf: (letter) => `${refOf(item)}.${letter}`,
              onPick: (letter) =>
                isDone ? undefined : answer($, item, letter),
              onNote: (said) => (isDone ? undefined : note($, item, said)),
            })}
          </Box>
        );
      })}
    </Box>
  );
};

/**
 * One Decide item as the skill writes it: the title, the note, and each
 * option a plain button reading `glyph letter. name: consequence`, its ➕ and
 * ➖ lines indented under it, always in full.
 */
const itemView = (
  elements: Elements,
  colors: Settings["colors"],
  item: DecideItem,
  view: {
    title: string;
    chosen: readonly string[];
    note: string;
    isSettled?: boolean;
    keyOf: (letter: string) => string;
    onPick: (letter: string) => unknown;
    onNote: (note: string) => unknown;
  },
) => {
  const { Box, Button, Input, Text } = elements;
  const dim = view.isSettled === true;
  const inline = (
    line: string,
    key: string,
    props: Record<string, unknown> = {},
  ) =>
    codeSpans(line).map((part, n) => (
      <Text
        key={`${key}-${n}`}
        {...props}
        {...(part.isCode ? { color: colors.code } : {})}
      >
        {part.text}
      </Text>
    ));
  const lines = (
    prefix: string,
    texts: readonly string[] | undefined,
    background: string | undefined,
    key: string,
  ) =>
    (texts ?? []).map((line, n) => (
      <Box key={`${key}-${n}`} marginLeft={INDENT}>
        <Text
          dimColor={dim}
          {...(background ? { backgroundColor: background } : {})}
          wrap="wrap"
        >
          {prefix ? `${prefix} ` : ""}
          {inline(line, `${key}-${n}`)}
        </Text>
      </Box>
    ));

  return (
    <Box flexDirection="column">
      <Text
        bold={!dim}
        dimColor={dim}
        color={dim ? undefined : colors.title}
        wrap="wrap"
      >
        {inline(view.title, "title")}
      </Text>
      {lines("", item.note, undefined, "note")}
      {item.options.map((option) => {
        const isChosen = view.chosen.includes(option.letter);
        const pick = isChosen ? { backgroundColor: colors.chosen } : {};
        const key = view.keyOf(option.letter);
        // A Button holds only text, so each of the option's lines is a button
        // of its own that picks it. They share a hover group, so the pointer
        // on any of them lights the gutter beside every one: a bar the
        // option's height. A settled option's gutter stays dark.
        const hover = { scope: key, backgroundColor: colors.hover } as const;
        const press = {
          plain: true,
          dimColor: dim,
          hover: { scope: key },
          onPress: () => view.onPick(option.letter),
        } as const;
        // One line of the option: the gutter cell, then the line, which wraps
        // beside it; the gutter's Box stretches to the line's rows.
        const row = (rowKey: string, content: RenderNode) => (
          <Box key={`${rowKey}-row`}>
            <Box
              key={`${rowKey}-gutter`}
              width={GUTTER}
              flexShrink={0}
              {...(dim ? {} : { hover })}
            >
              <Text {...(dim ? {} : { hover })}> </Text>
            </Box>
            {content}
          </Box>
        );
        const under = (
          prefix: string,
          texts: readonly string[] | undefined,
          part: string,
        ) =>
          (texts ?? []).map((line, n) =>
            row(
              `${key}-${part}-${n}`,
              <Box key={`${key}-${part}-${n}-box`} marginLeft={INDENT}>
                <Button key={`${key}-${part}-${n}`} label={line} {...press}>
                  <Text {...pick}>{prefix ? `${prefix} ` : ""}</Text>
                  {inline(line, `${key}-${part}-${n}`, pick)}
                </Button>
              </Box>,
            ),
          );

        return (
          <Box
            key={`${key}-box`}
            flexDirection="column"
            marginLeft={INDENT - GUTTER}
          >
            {row(
              key,
              <Button key={key} label={option.name} {...press}>
                <Text {...pick}>
                  {glyphOf(item, option.letter)} {option.letter}.{" "}
                </Text>
                {inline(option.name, `${option.letter}-name`, {
                  ...pick,
                  bold: true,
                })}
                {option.consequence ? <Text {...pick}>: </Text> : null}
                {option.consequence
                  ? inline(option.consequence, `${option.letter}-then`, pick)
                  : null}
              </Button>,
            )}
            {under("➕", option.pros, "pro")}
            {under("➖", option.cons, "con")}
            {under("", option.notes, "note")}
          </Box>
        );
      })}
      {dim ? null : (
        <Box key={`${view.keyOf("notes")}-box`} marginLeft={INDENT}>
          <Input
            key={view.keyOf("notes")}
            label="✏️ "
            placeholder="Notes, or an answer in your own words"
            submitLabel="add to the draft"
            value={view.note}
            onSubmit={(said) => view.onNote(said)}
          />
        </Box>
      )}
    </Box>
  );
};
