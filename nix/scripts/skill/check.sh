# Check that plugin/skills/ ($committed) is the flake's skills folder
# ($built), the derived skill as a git install loads it: the same files,
# byte for byte, and each with the same mode, so a file the flake no
# longer makes, a sibling folder, or a lost executable bit fails as a
# changed file does. $committed is empty where plugin/skills/ is missing,
# or untracked, which a flake doesn't see. Names what differs, and the
# command that lays the flake's.
refresh="run refresh-skill in the dev shell, then commit plugin/skills/"

if [ -z "$committed" ]; then
  echo "plugin/skills/ is missing, or git doesn't track it; $refresh" >&2
  exit 1
fi

if ! diff --recursive "$built" "$committed" >&2; then
  echo "plugin/skills/ is not the flake's skills folder; $refresh" >&2
  exit 1
fi

modes() {
  (cd "$1" && find . -printf '%M %P\n' | sort)
}

if ! diff <(modes "$built") <(modes "$committed") >&2; then
  echo "plugin/skills/ holds a file whose mode is not the flake's; $refresh" >&2
  exit 1
fi
touch "$out"
