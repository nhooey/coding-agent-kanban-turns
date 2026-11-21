// The settings the shipped defaults file gives with no user file of its
// own: the Node tests hand its marks to a pure function that draws one, so
// what they expect is what the pane draws by default.

import { readFileSync } from "node:fs";

import { DEFAULTS_FILE, loaded } from "../../src/config/config.ts";
import type { Settings } from "../../types/index.d.ts";

const text = readFileSync(new URL(`../../${DEFAULTS_FILE}`, import.meta.url), "utf8");
const settings = loaded({ path: DEFAULTS_FILE, text }, undefined).settings;

if (settings === null) {
  throw new Error(`${DEFAULTS_FILE} gives no settings`);
}

/** The settings in effect with the shipped defaults alone. */
export const SHIPPED_SETTINGS: Settings = settings;
