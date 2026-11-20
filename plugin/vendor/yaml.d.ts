// The part of vendor/yaml.js that src/config.ts calls: the `yaml` package,
// bundled into one ES module by the flake (nix/bundle-vendor.sh), which the
// dev shell lays here. Self-contained, as the built plugin carries no
// node_modules to resolve the package's own types from;
// test/vendor-types.ts holds these to the package's own.

/** An error or warning the parser found: its message says where. */
export interface YAMLError {
  readonly message: string;
}

/** One document of a YAML stream. */
export interface ParsedDocument {
  readonly errors: readonly YAMLError[];
  readonly warnings: readonly YAMLError[];
  /** The document's value as plain data. */
  toJS(): unknown;
}

/** The options src/config.ts reads with. */
export interface Options {
  readonly version?: "1.1" | "1.2" | "next";
  readonly schema?: string;
  readonly strict?: boolean;
  readonly uniqueKeys?: boolean;
  readonly merge?: boolean;
  readonly stringKeys?: boolean;
  readonly resolveKnownTags?: boolean;
  readonly prettyErrors?: boolean;
  readonly logLevel?: "silent" | "error" | "warn" | "debug";
}

/** Every document in `source`, each with its errors and warnings. */
export declare function parseAllDocuments(
  source: string,
  options?: Options,
): readonly ParsedDocument[];
