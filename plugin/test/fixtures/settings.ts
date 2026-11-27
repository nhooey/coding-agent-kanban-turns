// The settings the tests use: the shipped defaults file,
// defaults/config.yaml, merged as the plugin merges it with no user file of
// its own, whose marks the tests hand to the pure functions that draw one,
// so what they expect is what the pane draws by default; and the variants
// the pane-state tests step with, the close setting either way, a user
// file's warning, and a defaults file that can't be used.

import { readFileSync } from "node:fs";

import fc from "fast-check";

import { DEFAULTS_FILE, loaded } from "../../src/config/config.ts";
import { settingsFrom } from "../../src/views/pane-state.ts";
import type { Loaded, PaneState, Settings } from "../../types/index.d.ts";

const SHIPPED: Loaded = loaded(
  {
    path: DEFAULTS_FILE,
    text: readFileSync(new URL(`../../${DEFAULTS_FILE}`, import.meta.url), "utf8"),
  },
  undefined,
);

if (SHIPPED.settings === null) {
  throw new Error(`${DEFAULTS_FILE} can't be used: ${SHIPPED.problems.join("; ")}`);
}

/** The shipped defaults' settings. */
export const SETTINGS: Settings = SHIPPED.settings;

/** The count line's settings, as the defaults give them. */
export const COUNTS: Settings["counts"] = SETTINGS.counts;

/** What a user file may be wrong with while the settings stay usable. */
export const BAD_KEY = "config.yaml: bad key";

/** Why a defaults file can't be used. */
export const MISSING = "defaults/config.yaml: missing";

/** The settings the files merge to: the defaults, the close setting `isClosed`, a user file wrong with `warnings`. */
export const usable = (isClosed: boolean, warnings: readonly string[] = []): Loaded => ({
  settings: { ...SETTINGS, pane: { ...SETTINGS.pane, "close-when-all-submitted": isClosed } },
  effective: SHIPPED.effective,
  problems: warnings,
});

/** A defaults file that can't be used. */
export const BROKEN: Loaded = { settings: null, effective: [], problems: [MISSING] };

/** `state` with `loaded` in effect, as no read has given it: a read asked for from now replaces it. */
export const withSettings = (state: PaneState, loaded: Loaded): PaneState => ({
  ...state,
  settings: settingsFrom(loaded, state.settings.asked, 0),
});

/** `state` with the defaults in effect, the close setting `isClosed`. */
export const withClosing = (state: PaneState, isClosed: boolean): PaneState =>
  withSettings(state, usable(isClosed));

/** What a read of the settings files may find: usable, either way on closing, with a warning or none; or unusable. */
export const loadedArb: fc.Arbitrary<Loaded> = fc.oneof(
  {
    arbitrary: fc
      .tuple(fc.boolean(), fc.constantFrom<readonly string[]>([], [BAD_KEY]))
      .map(([isClosed, warnings]) => usable(isClosed, warnings)),
    weight: 4,
  },
  { arbitrary: fc.constant(BROKEN), weight: 1 },
);
