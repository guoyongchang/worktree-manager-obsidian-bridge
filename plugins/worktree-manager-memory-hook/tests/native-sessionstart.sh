#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"
PLUGIN_DIR="$ROOT_DIR/plugins/worktree-manager-memory-hook"
HOOKS_FILE="$PLUGIN_DIR/hooks/hooks.json"
SETUP_SCRIPT="$PLUGIN_DIR/scripts/setup.sh"

python3 - "$HOOKS_FILE" <<'PYEOF'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)

hooks = data.get("hooks", {})
assert "Setup" in hooks, "Setup hook missing"
assert "SessionStart" in hooks, "SessionStart hook missing"

setup_cmd = hooks["Setup"][0]["hooks"][0]["command"]
assert "setup.sh" in setup_cmd, f"unexpected Setup command: {setup_cmd}"

session_start_cmd = hooks["SessionStart"][0]["hooks"][0]["command"]
assert "inject-context.ts" in session_start_cmd, f"unexpected SessionStart command: {session_start_cmd}"
assert "${CLAUDE_PLUGIN_ROOT}" in session_start_cmd, "SessionStart should use CLAUDE_PLUGIN_ROOT"
PYEOF
session_start_cmd="$(python3 - "$HOOKS_FILE" <<'PYEOF'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)

print(data["hooks"]["SessionStart"][0]["hooks"][0]["command"])
PYEOF
)"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
mkdir -p "$tmpdir/.claude"
printf '%s\n' '{"enabledPlugins":{"existing":"1"}}' > "$tmpdir/.claude/settings.json"
before_contents="$(cat "$tmpdir/.claude/settings.json")"

HOME="$tmpdir" bash "$SETUP_SCRIPT" "$PLUGIN_DIR" >/tmp/worktree-memory-hook-setup.out 2>/tmp/worktree-memory-hook-setup.err

after_contents="$(cat "$tmpdir/.claude/settings.json")"
if [ "$before_contents" != "$after_contents" ]; then
  echo "settings.json changed unexpectedly"
  diff -u <(printf '%s' "$before_contents") <(printf '%s' "$after_contents") || true
  exit 1
fi

if [ -e "$tmpdir/.claude/worktree-memory-uninstall.sh" ]; then
  echo "setup.sh should not install an uninstall helper"
  exit 1
fi

session_output="$(
  HOME="$tmpdir" \
  CLAUDE_PLUGIN_ROOT="$PLUGIN_DIR" \
  bash -lc "$session_start_cmd"
)"

printf '%s\n' "$session_output" | grep -q "<display-to-user>" || {
  echo "SessionStart command did not produce status block"
  exit 1
}

final_contents="$(cat "$tmpdir/.claude/settings.json")"
if [ "$before_contents" != "$final_contents" ]; then
  echo "setup.sh changed settings.json unexpectedly"
  diff -u <(printf '%s' "$before_contents") <(printf '%s' "$final_contents") || true
  exit 1
fi

echo "native SessionStart validation passed"
