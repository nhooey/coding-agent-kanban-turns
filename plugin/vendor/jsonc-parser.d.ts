// The part of vendor/jsonc-parser.js that src/config.ts calls: the
// `jsonc-parser` package, bundled into one ES module by the flake
// (nix/bundle-vendor.sh), which the dev shell lays here. Self-contained, as
// the built plugin carries no node_modules to resolve the package's own types
// from; test/vendor-types.ts holds these to the package's own.

/** The text with each comment replaced by `replaceCh`, or taken out without one. */
export declare function stripComments(text: string, replaceCh?: string): string;
