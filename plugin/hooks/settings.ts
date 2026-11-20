// Reads the two settings files, the shipped defaults in the plugin's folder and
// the user's own, and hands their text to the pure merge in src/config/config.ts.
// The user's own is config.yaml, under $XDG_CONFIG_HOME or ~/.config.
//
// Function declarations, not arrows: `claude plugin validate` follows `$`
// past an import only into a declaration.

import type { EngineInterface } from "claude-code";

import { DEFAULTS_FILE, loaded, userConfigPath } from "../src/config/config.ts";
import type { ConfigFile } from "../src/config/config.ts";
import type { Loaded } from "../types/index.d.ts";

/** A file's text, or none when it isn't there. */
async function textOf(
  $: EngineInterface,
  path: string | undefined,
): Promise<ConfigFile | undefined> {
  return path !== undefined && (await $.fs.exists(path))
    ? { path, text: await $.fs.read(path) }
    : undefined;
}

/** The settings in effect now, read from both files afresh. */
export async function loadSettings($: EngineInterface): Promise<Loaded> {
  const defaultsPath = `${$.plugin.root}/${DEFAULTS_FILE}`;
  const userPath = userConfigPath({
    xdgConfigHome: await $.env.get("XDG_CONFIG_HOME"),
    home: await $.env.get("HOME"),
  });

  return loaded(
    (await textOf($, defaultsPath)) ?? { path: defaultsPath, text: undefined },
    await textOf($, userPath),
  );
}
