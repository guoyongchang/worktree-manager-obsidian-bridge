#!/usr/bin/env bash
set -euo pipefail

# uninstall.sh — Remove SessionStart hook from ~/.claude/settings.json
# Intended to be run from ~/.claude/worktree-memory-uninstall.sh

MARKER="worktree-manager-memory-hook"
SETTINGS_FILE="$HOME/.claude/settings.json"

# --- Check settings.json exists ---
if [ ! -f "$SETTINGS_FILE" ]; then
  echo "[${MARKER}] settings.json not found, nothing to remove."
  exit 0
fi

# --- Check python3 ---
if ! command -v python3 &>/dev/null; then
  echo "[${MARKER}] ERROR: python3 is required but not found." >&2
  exit 1
fi

# --- Backup settings.json ---
cp "$SETTINGS_FILE" "${SETTINGS_FILE}.bak"

# --- Remove hook entry via python3 ---
python3 - "$SETTINGS_FILE" "$MARKER" << 'PYEOF'
import json, sys

settings_file = sys.argv[1]
marker = sys.argv[2]

with open(settings_file, "r") as f:
    settings = json.load(f)

hooks = settings.get("hooks", {})
session_start = hooks.get("SessionStart", [])

if not session_start:
    print(f"[{marker}] nothing to remove.")
    sys.exit(0)

# Filter out entries containing the marker
original_len = len(session_start)
session_start = [
    entry for entry in session_start
    if not any(marker in h.get("command", "") for h in entry.get("hooks", []))
]

if len(session_start) == original_len:
    print(f"[{marker}] nothing to remove.")
    sys.exit(0)

# Clean up empty structures
if session_start:
    hooks["SessionStart"] = session_start
else:
    del hooks["SessionStart"]

if hooks:
    settings["hooks"] = hooks
elif "hooks" in settings:
    del settings["hooks"]

with open(settings_file, "w") as f:
    json.dump(settings, f, indent=2, ensure_ascii=False)
    f.write("\n")

print(f"[{marker}] uninstalled.")
PYEOF

# --- Self-delete ---
SELF="$HOME/.claude/worktree-memory-uninstall.sh"
if [ -f "$SELF" ]; then
  rm "$SELF"
fi
