// A module holding each inline import the dependency check doesn't see:
// three import types inside other types, and a dynamic import of a name.

export type State = import("claude-code").PluginState;
export type Stats = Readonly<import("node:fs").Stats>;
export type FileSystem = typeof import("node:fs");
export const loaded = (name: string): Promise<unknown> => import(name);
