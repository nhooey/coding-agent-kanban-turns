// How an item's text is laid out: the pane's fixed spacing and the
// characters that structure its lines, and an item's code spans. The cells
// a line's lead takes are src/text/cells.ts's. The marks a user may change
// are settings, in defaults/config.yaml's `marks`; the protocol's glyphs
// are the spec's.

/**
 * The pane's geometry, which no setting changes: widths and gaps in
 * terminal cells, margins in rows.
 */
export const LAYOUT = {
  /** Columns an option sits in from its item's summary, and its ➕ and ➖ lines from the option. */
  indent: 3,
  /**
   * The column left of an option's lines that lights while the pointer is
   * over the option, or stays lit once its item is Done: it comes out of
   * the option's indent, so its text stays put.
   */
  gutter: 1,
  /** The cells between an item's label and its summary on its title line. */
  titleGap: 1,
  /** The cells between a label and the text after it, on a Done line or in the keys panel. */
  labelGap: 2,
  /** The cells either side of an item's text inside its border. */
  boxPadding: 1,
  /** The border an item's box is drawn with. */
  border: "round",
  /** The rows between the pane's blocks: its header, the keys panel, each turn and its footer. */
  blockGap: 1,
  /** The cells between the controls in a row, and between a row's groups. */
  controlGap: 2,
  /** The fewest rows the notes field is drawn: a setting of fewer draws this many. */
  fewestNoteRows: 1,
  /** What parts the pieces of one line: the count line's after 🖥️ Kanban, a Done line's, the footer's. */
  divider: " · ",
  /** What a turn's header sits between, `── 9efb08a1 ₋₃ ──`. */
  rule: "──",
} as const;

/** A line split at its backticks: even parts are prose, odd parts code. */
export const codeSpans = (
  line: string,
): readonly { text: string; isCode: boolean }[] =>
  line
    .split("`")
    .map((text, n) => ({
      text: text.replaceAll("**", ""),
      isCode: n % 2 === 1,
    }))
    .filter((part) => part.text !== "");
