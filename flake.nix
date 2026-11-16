{
  description = "coding-agent-kanban-turns: the kanban turn responses' Claude Code mod";

  inputs = {
    # Rolling, for a current Node: the mod's tests run TypeScript straight
    # through `node --test`, and its TypeScript 7 wants a recent runtime.
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts = {
      url = "github:hercules-ci/flake-parts";
      inputs.nixpkgs-lib.follows = "nixpkgs";
    };
    systems.url = "github:nix-systems/default";
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
        { pkgs, ... }:
        let
          # The one Node: the mod's node_modules are built with it, and the
          # dev shell and the checks run it.
          nodejs = pkgs.nodejs_26;

          # mod/'s npm dependencies (TypeScript, Node's types, Jest's
          # expect), each fetched by the integrity hash its
          # package-lock.json records: no `npm ci`, and no hash to keep
          # beside the lock. Built from the two files alone, so an edit
          # elsewhere in mod/ rebuilds nothing.
          modNodeModules = pkgs.importNpmLock.buildNodeModules {
            package = builtins.fromJSON (builtins.readFile ./mod/package.json);
            packageLock = builtins.fromJSON (builtins.readFile ./mod/package-lock.json);
            inherit nodejs;
          };

          # Runs one of mod/package.json's scripts in a writable copy of
          # mod/, with the flake's node_modules linked in.
          modCheck =
            name: script:
            pkgs.runCommand "coding-agent-kanban-turns-${name}"
              {
                nativeBuildInputs = [ nodejs ];
                src = ./mod;
              }
              ''
                cp -R "$src" mod
                chmod -R u+w mod
                cd mod
                ln -s ${modNodeModules}/node_modules node_modules
                export HOME="$TMPDIR/home"
                npm run --silent ${script}
                touch $out
              '';
        in
        {
          # Repo-specific packages and commands, merged onto the module's.
          devshells.default = {
            packages = [
              nodejs
              pkgs.git
            ];
            env = [
              {
                name = "MOD_NODE_MODULES";
                value = "${modNodeModules}/node_modules";
              }
            ];
            devshell.startup.link-node-modules.text = builtins.readFile ./nix/link-node-modules.sh;
            commands = [
              {
                category = "test";
                name = "tests";
                help = "run the core's tests under node --test (npm test in mod/)";
                command = ''cd "$PRJ_ROOT/mod" && npm test -- "$@"'';
              }
              {
                category = "test";
                name = "typecheck";
                help = "type-check the core and its tests (npm run typecheck in mod/)";
                command = ''cd "$PRJ_ROOT/mod" && npm run typecheck'';
              }
              {
                category = "test";
                name = "typecheck-plugin";
                help = "type-check the hooks against the engine's API, which Claude Code lays in mod/.claude-plugin/types/";
                command = ''cd "$PRJ_ROOT/mod" && npm run typecheck:plugin'';
              }
              {
                category = "test";
                name = "plugin-test";
                help = "claude plugin validate, then the engine-driven tests in mod/mod-tests/ (needs the claude CLI)";
                command = ''bash "$PRJ_ROOT/mod/tools/plugin-test.sh"'';
              }
            ];
          };

          # What a build can run: the core's type-check and its tests. The
          # hooks' type-check and mod-tests/ need the engine (its API
          # declarations, and claude plugin test), which a build has not.
          checks = {
            typecheck = modCheck "typecheck" "typecheck";
            tests = modCheck "tests" "test";
          };

          treefmt = {
            projectRootFile = "flake.nix";
            programs.nixfmt.enable = true;
          };
        };
    };
}
