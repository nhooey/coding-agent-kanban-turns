// The shape the shipped defaults file, defaults/config.yaml, must give: every
// setting the plugin reads, in the file's order, by the type its value must
// have. A setting added to the defaults file is added here too.

import type { Shape } from "../../src/config/config.ts";

/** Every setting the plugin reads, by the type its value must have. */
export const SETTINGS_SHAPE: Shape = {
  counts: { turns: "number", "gh-timeout-ms": "number" },
  keys: {
    dismiss: "key",
    next: "key",
    previous: "key",
    submit: "key",
    reassess: "key",
    help: "key",
  },
  pane: { "close-when-all-submitted": "boolean" },
  notes: { rows: "number" },
  marks: { sent: "string" },
  colors: {
    border: "string",
    "title-label": "string",
    "title-background": "string",
    code: "string",
    hover: "string",
    settled: "string",
    close: "string",
    kanban: "string",
  },
  "roll-up": { "summary-width": "number" },
  lint: { "turn-end": "boolean" },
};
