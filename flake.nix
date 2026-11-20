{
  description = "coding-agent-kanban-turns: the kanban turn responses' Claude Code plugin";

  inputs = {
    # Rolling, for a current Node: the plugin's tests run TypeScript straight
    # through `node --test`, and its TypeScript 7 wants a recent runtime.
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts = {
      url = "github:hercules-ci/flake-parts";
      inputs.nixpkgs-lib.follows = "nixpkgs";
    };
    systems.url = "github:nix-systems/default";
    # flakeModules.claudePlugin, which builds `plugin` and adds the
    # `plugin-build` command. agent-plugins-nixpkgs takes this repository as
    # its coding-agent-kanban-turns input, so that input follows this flake
    # (`""`) rather than locking another copy of it, and the two lock files
    # don't nest each other at every update.
    agent-plugins-nixpkgs = {
      url = "github:nhooey/agent-plugins-nixpkgs";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        flake-parts.follows = "flake-parts";
        coding-agent-kanban-turns.follows = "";
        devshell.follows = "agent-skill-flake/devshell";
        treefmt-nix.follows = "treefmt-nix";
      };
    };
    # The dev-shell skills wiring (flakeModules.devshellSkills), which
    # bundles numtide/devshell. The skill sources are not inputs here: they
    # live only in skills-devshell/'s lock, which the dev shell runs on
    # entry, so this flake stays a leaf with no skill inputs.
    agent-skill-flake = {
      url = "github:nhooey/agent-skill-flake";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      flake-parts,
      systems,
      ...
    }@inputs:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = import systems;
      imports = [
        # Builds plugin/ as packages.plugin, and adds the `plugin-build`
        # command that links it to result-plugin.
        inputs.agent-plugins-nixpkgs.flakeModules.claudePlugin
        # Bundles numtide/devshell, the skills startup that installs
        # skills-devshell/'s skills into .agents/skills, and the check, fmt,
        # update-flake, reap-skills and update-skills-devshell commands.
        inputs.agent-skill-flake.flakeModules.devshellSkills
        inputs.treefmt-nix.flakeModule
      ];

      agent-skill-flake.devshellSkills = {
        name = "coding-agent-kanban-turns";
        motd = ''
          {bold}{14}🧠 Entering the coding-agent-kanban-turns dev shell{reset}
          Run {bold}menu{reset} to list available commands.
        '';
      };

      perSystem =
        { config, pkgs, ... }:
        let
          # The one Node: the plugin's node_modules are built with it, and the
          # dev shell and the checks run it.
          nodejs = pkgs.nodejs_26;

          # plugin/'s npm dependencies (TypeScript, Node's types, Jest's
          # expect), each fetched by the integrity hash its
          # package-lock.json records: no `npm ci`, and no hash to keep
          # beside the lock. Built from the two files alone, so an edit
          # elsewhere in plugin/ rebuilds nothing.
          pluginNodeModules = pkgs.importNpmLock.buildNodeModules {
            package = builtins.fromJSON (builtins.readFile ./plugin/package.json);
            packageLock = builtins.fromJSON (builtins.readFile ./plugin/package-lock.json);
            inherit nodejs;
          };

          # Runs one of plugin/package.json's scripts in a writable copy of
          # plugin/, with the flake's node_modules linked in.
          pluginCheck =
            name: script:
            pkgs.runCommand "coding-agent-kanban-turns-${name}"
              {
                nativeBuildInputs = [ nodejs ];
                src = ./plugin;
              }
              ''
                cp -R "$src" plugin
                chmod -R u+w plugin
                cd plugin
                ln -s ${pluginNodeModules}/node_modules node_modules
                export HOME="$TMPDIR/home"
                npm run --silent ${script}
                touch $out
              '';
        in
        {
          # The plugin as Claude Code loads it: plugin/ with only what runs,
          # its manifest, hooks, pure core, shipped defaults and the types the
          # manifest names. The tests, the engine-driven tests, the tools and
          # the npm files stay out, since every npm dependency is for
          # development. agent-plugins-nixpkgs installs this through its
          # nix-darwin module, and a `--plugin-dir result-plugin` session
          # loads it after `plugin-build`.
          agent-plugins.claudePlugin = {
            enable = true;
            src = ./plugin;
            include = [
              ".claude-plugin/plugin.json"
              "defaults"
              "hooks"
              "src"
              "types"
            ];
          };

          packages.default = config.packages.plugin;

          # Repo-specific packages and commands, merged onto the modules'.
          devshells.default = {
            packages = [
              nodejs
              pkgs.git
            ];
            env = [
              {
                name = "PLUGIN_NODE_MODULES";
                value = "${pluginNodeModules}/node_modules";
              }
            ];
            devshell.startup.link-node-modules.text = builtins.readFile ./nix/link-node-modules.sh;
            commands = [
              {
                category = "test";
                name = "tests";
                help = "run the core's tests under node --test (npm test in plugin/)";
                command = ''cd "$PRJ_ROOT/plugin" && npm test -- "$@"'';
              }
              {
                category = "test";
                name = "typecheck";
                help = "type-check the core and its tests (npm run typecheck in plugin/)";
                command = ''cd "$PRJ_ROOT/plugin" && npm run typecheck'';
              }
              {
                category = "test";
                name = "typecheck-plugin";
                help = "type-check the hooks against the engine's API, which Claude Code lays in plugin/.claude-plugin/types/";
                command = ''cd "$PRJ_ROOT/plugin" && npm run typecheck:plugin'';
              }
              {
                category = "test";
                name = "plugin-test";
                help = "claude plugin validate, then the engine-driven tests in plugin/plugin-tests/ (needs the claude CLI)";
                command = ''bash "$PRJ_ROOT/plugin/tools/plugin-test.sh"'';
              }
            ];
          };

          # What a build can run: the core's type-check and its tests. The
          # hooks' type-check and plugin-tests/ need the engine (its API
          # declarations, and claude plugin test), which a build has not.
          checks = {
            inherit (config.packages) plugin;
            typecheck = pluginCheck "typecheck" "typecheck";
            tests = pluginCheck "tests" "test";
          };

          treefmt = {
            projectRootFile = "flake.nix";
            programs.nixfmt.enable = true;
          };
        };
    };
}
