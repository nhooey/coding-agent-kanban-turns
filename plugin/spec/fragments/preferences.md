## Your preferences

!`cat "${CLAUDE_SKILL_DIR}/../{{skill.name}}.preferences.md" "${CLAUDE_PROJECT_DIR}/.agents/skills/{{skill.name}}.preferences.md" 2>/dev/null || true`

If your agent doesn't run the line above, read these files yourself where they exist: `{{skill.name}}.preferences.md` next to this skill's folder, the user's, then `.agents/skills/{{skill.name}}.preferences.md` in the project. A project's file wins over the user's, and the user's over this skill's defaults. A file that isn't there is skipped.
