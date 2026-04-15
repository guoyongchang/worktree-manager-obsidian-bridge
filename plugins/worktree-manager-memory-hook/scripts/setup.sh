#!/usr/bin/env bash
set -euo pipefail

# setup.sh — Write SessionStart hook into ~/.claude/settings.json
# Called by the plugin's Setup hook with CLAUDE_PLUGIN_ROOT as $1

MARKER="worktree-manager-memory-hook"
VERSION="2.0.0"
SETTINGS_FILE="$HOME/.claude/settings.json"

# --- Validate args ---
if [ -z "${1:-}" ]; then
  echo "[${MARKER}] ERROR: CLAUDE_PLUGIN_ROOT not provided." >&2
  exit 1
fi

PLUGIN_ROOT="$(cd "$1" && pwd)"

# --- Check python3 ---
if ! command -v python3 &>/dev/null; then
  echo "[${MARKER}] ERROR: python3 is required but not found." >&2
  exit 1
fi

# --- Ensure settings.json exists ---
mkdir -p "$HOME/.claude"
if [ ! -f "$SETTINGS_FILE" ]; then
  echo '{}' > "$SETTINGS_FILE"
fi

# --- Backup settings.json ---
cp "$SETTINGS_FILE" "${SETTINGS_FILE}.bak"

# --- Inject SessionStart hook via python3 ---
python3 - "$SETTINGS_FILE" "$PLUGIN_ROOT" "$MARKER" "$VERSION" << 'PYEOF'
import json, sys

settings_file = sys.argv[1]
plugin_root = sys.argv[2]
marker = sys.argv[3]
version = sys.argv[4]

with open(settings_file, "r") as f:
    settings = json.load(f)

# Build the hook command with literal $HOME/$PATH (not expanded)
command = (
    f"# {marker} v{version}\n"
    f'export PATH="$HOME/.bun/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"; '
    f'bun run "{plugin_root}/scripts/inject-context.ts" 2>&1'
)

new_entry = {
    "hooks": [
        {
            "type": "command",
            "command": command,
            "timeout": 10000
        }
    ]
}

# Ensure hooks.SessionStart exists as an array
hooks = settings.setdefault("hooks", {})
session_start = hooks.setdefault("SessionStart", [])

# Find existing entry by marker
found_idx = None
for i, entry in enumerate(session_start):
    for h in entry.get("hooks", []):
        if marker in h.get("command", ""):
            found_idx = i
            break
    if found_idx is not None:
        break

if found_idx is not None:
    # Replace existing entry (supports path updates on reinstall)
    session_start[found_idx] = new_entry
else:
    # Append (don't overwrite user's other hooks)
    session_start.append(new_entry)

with open(settings_file, "w") as f:
    json.dump(settings, f, indent=2, ensure_ascii=False)
    f.write("\n")
PYEOF

# --- Copy uninstall script to fixed location ---
cp "$PLUGIN_ROOT/scripts/uninstall.sh" "$HOME/.claude/worktree-memory-uninstall.sh"
chmod +x "$HOME/.claude/worktree-memory-uninstall.sh"

echo "[${MARKER}] setup complete."
