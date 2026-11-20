{
  description = "coding-agent-kanban-turns dev-shell skill set — an isolated sub-flake invoked at RUNTIME by the root devShell, never a root input. The skill sources live only in THIS flake's lock, so the root flake stays a leaf with zero skill inputs and transitive consumers never drag the skill mesh in.";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default";

    # `agent-skill-flake` is the builder library, not a skill — it provides
    # `mkDevshellSkillsFlake`.
    agent-skill-flake = {
      url = "github:nhooey/agent-skill-flake";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    # Every input below this divider is a skill source.

    # skillspkgs' `claude-code-tools` combination, this repository's family:
    # the base skills, shipped defaults, changelogs and strict TypeScript.
    skillspkgs-combinations = {
      url = "github:nhooey/skillspkgs?dir=sources/combinations";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    # The same coding-agent-skills revision the combination takes, for the
    # one addition below.
    coding-agent-skills.follows = "skillspkgs-combinations/coding-agent-skills";

    # find-implicit-models, newer than the combination's pin of this
    # repository.
    software-design-skills = {
      url = "github:nhooey/software-design-skills";
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
      name = "coding-agent-kanban-turns-devshell";
      sources = [
        { source = inputs.skillspkgs-combinations.combinations.claude-code-tools; }
        # The kanban turn-response skill, whose rules this plugin renders and
        # shares (see AGENTS.md); no other Claude Code tool uses it.
        {
          source = inputs.coding-agent-skills;
          skills = [ "coding-agent-kanban-turn-responses" ];
        }
        # Finds the implicit models in the plugin's code; not in the family's
        # combination.
        {
          source = inputs.software-design-skills;
          skills = [ "design-hygiene-find-implicit-models" ];
        }
      ];
    };
}
