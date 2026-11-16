// The little of the engine's `claude-code` module that types/index.d.ts
// names, for Node's type-check of the core, which runs without the engine's
// declarations (tsconfig.plugin.json reads the real ones).
declare module "claude-code" {
  export type Shaped<T> = T;
  export interface PluginState {}
}
