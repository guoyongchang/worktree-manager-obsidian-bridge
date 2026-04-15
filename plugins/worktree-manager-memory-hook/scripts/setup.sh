#!/usr/bin/env bash
set -euo pipefail

# setup.sh — lightweight setup/diagnostics for the native SessionStart hook

MARKER="worktree-manager-memory-hook"
HOOK_PATH_PREFIX="$HOME/.bun/bin:/usr/local/bin:/opt/homebrew/bin"

if [ -z "${1:-}" ]; then
  echo "[${MARKER}] ERROR: CLAUDE_PLUGIN_ROOT not provided." >&2
  exit 1
fi

PLUGIN_ROOT="$(cd "$1" && pwd)"
echo "[${MARKER}] native SessionStart hook is bundled with the plugin."
echo "[${MARKER}] plugin root: $PLUGIN_ROOT"

if ! PATH="$HOOK_PATH_PREFIX:$PATH" command -v bun >/dev/null 2>&1; then
  echo "[${MARKER}] WARNING: bun was not found in PATH. SessionStart will fail until bun is installed." >&2
fi

echo "[${MARKER}] setup complete. Start a new Claude Code session if this plugin was just enabled."
