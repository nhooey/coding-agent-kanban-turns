// Reads the two settings files, the shipped defaults in the plugin's folder and
// the user's own, and hands their text to the pure merge in src/config.ts.
// The user's own is the first of its names that's there: config.yaml, else
// an old config.jsonc, which src/config.ts reads with a warning.
//
// Function declarations, not arrows: `claude plugin validate` follows `$`
// past an import only into a declaration.

import type { EngineInterface } from "claude-code";

import { DEFAULTS_FILE, loaded, userConfigPaths } from "../src/config.ts";
import type { ConfigFile } from "../src/config.ts";
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

/** The first of the files that's there, or none. */
async function firstOf(
  $: EngineInterface,
  paths: readonly string[],
): Promise<ConfigFile | undefined> {
  const [path, ...rest] = paths;

  return path === undefined
    ? undefined
    : ((await textOf($, path)) ?? (await firstOf($, rest)));
}

/** The settings in effect now, read from both files afresh. */
export async function loadSettings($: EngineInterface): Promise<Loaded> {
  const defaultsPath = `${$.plugin.root}/${DEFAULTS_FILE}`;
  const userPaths = userConfigPaths({
    xdgConfigHome: await $.env.get("XDG_CONFIG_HOME"),
    home: await $.env.get("HOME"),
  });

  return loaded(
    (await textOf($, defaultsPath)) ?? { path: defaultsPath, text: "" },
    await firstOf($, userPaths),
  );
}
