{
  description = "claude-code-kanban-turns dev-shell skill set — an isolated sub-flake invoked at RUNTIME by the root devShell, never a root input. The skill sources live only in THIS flake's lock, so the root flake stays a leaf with zero skill inputs and transitive consumers never drag the skill mesh in.";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default";

    # `agent-skill-flake` is the builder library, not a skill — it provides
    # `mkDevshellSkillsFlake`. Followed by every skill source below so the
    # whole tree shares one evaluation.
    agent-skill-flake = {
      url = "github:nhooey/agent-skill-flake";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    # Every input below this divider is a skill source, each on its
    # repository's default branch.

    # The kanban turn-response skill this mod shares its rules with, headless
    # runs in checkouts, tidy scratchpads and the plan graph in agents/plans/.
    coding-agent-skills = {
      url = "github:nhooey/coding-agent-skills";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        agent-skill-flake.follows = "agent-skill-flake";
      };
    };

    # Markdown hygiene, for the README and AGENTS.md.
    document-skills = {
      url = "github:nhooey/document-skills";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        agent-skill-flake.follows = "agent-skill-flake";
      };
    };

    # Git and GitHub hygiene, policy and workflow.
    git-skills = {
      url = "github:nhooey/git-skills";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        agent-skill-flake.follows = "agent-skill-flake";
      };
    };

    # nix-flakes, which this repository's flake.nix follows.
    nix-skills = {
      url = "github:nhooey/nix-skills";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        agent-skill-flake.follows = "agent-skill-flake";
      };
    };

    # Safe shell commands, and commands as CLI tools.
    shell-skills = {
      url = "github:nhooey/shell-skills";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        agent-skill-flake.follows = "agent-skill-flake";
      };
    };

    # Prose hygiene, for the README, AGENTS.md and commit messages.
    writing-skills = {
      url = "github:nhooey/writing-skills";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        agent-skill-flake.follows = "agent-skill-flake";
      };
    };

    # config-hygiene-shipped-defaults, which mod/defaults/config.jsonc follows.
    software-design-skills = {
      url = "github:nhooey/software-design-skills";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        agent-skill-flake.follows = "agent-skill-flake";
      };
    };

    # Pyroxin's opinionated-software-engineering plugin, packaged by
    # skillspkgs: the functional style the mod's TypeScript is written in.
    skillspkgs-opinionated-software-engineering = {
      url = "github:nhooey/skillspkgs?dir=pkgs/opinionated-software-engineering";
      inputs = {
        nixpkgs.follows = "nixpkgs";
        agent-skill-flake.follows = "agent-skill-flake";
      };
    };
  };

  outputs =
    {
      nixpkgs,
      agent-skill-flake,
      ...
    }@inputs:
    agent-skill-flake.lib.mkDevshellSkillsFlake {
      inherit nixpkgs;
      systems = import inputs.systems;
      name = "claude-code-kanban-turns-devshell";
      sources = [
        { source = inputs.coding-agent-skills; }
        { source = inputs.document-skills; }
        { source = inputs.git-skills; }
        {
          source = inputs.nix-skills;
          skills = [ "nix-flakes" ];
        }
        { source = inputs.shell-skills; }
        { source = inputs.writing-skills; }
        { source = inputs.software-design-skills; }
        {
          source = inputs.skillspkgs-opinionated-software-engineering;
          prefix = "opsofteng";
        }
      ];
    };
}
