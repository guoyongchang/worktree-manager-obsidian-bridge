# Memory-Hook Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix SessionStart hook triggering by using a Setup hook to write the SessionStart command into `~/.claude/settings.json`, and provide automated install/uninstall scripts.

**Architecture:** Plugin's `hooks.json` registers a `Setup` hook that runs `setup.sh` at install time. `setup.sh` writes the SessionStart hook (with resolved absolute path) into `~/.claude/settings.json`. A paired `uninstall.sh` is copied to `~/.claude/` for safe cleanup.

**Tech Stack:** Bash (setup/uninstall scripts), Python3 (JSON manipulation), Bun/TypeScript (inject-context)

**Spec:** `docs/superpowers/specs/2026-04-15-memory-hook-improvement-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `hooks/hooks.json` | Modify | Replace `SessionStart` with `Setup` hook |
| `scripts/setup.sh` | Create | Write SessionStart hook to `~/.claude/settings.json`, copy uninstall script |
| `scripts/uninstall.sh` | Create | Remove hook from `settings.json`, self-delete |
| `scripts/inject-context.ts` | Modify | Add `<display-to-user>` to `.catch()` error path |
| `package.json` | Modify | Version bump to `2.0.0` |
| `.claude-plugin/plugin.json` | Modify | Version bump to `2.0.0` |
| `../../.claude-plugin/marketplace.json` | Modify | Plugin version bump to `2.0.0` |
| `README.md` | Modify | Update install/uninstall instructions |

---

### Task 1: Replace hooks.json with Setup-only hook

**Files:**
- Modify: `plugins/worktree-manager-memory-hook/hooks/hooks.json`

- [ ] **Step 1: Replace hooks.json content**

Replace the entire file with the Setup-only hook:

```json
{
  "hooks": {
    "Setup": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh\" \"${CLAUDE_PLUGIN_ROOT}\"",
            "timeout": 10000
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `python3 -m json.tool plugins/worktree-manager-memory-hook/hooks/hooks.json`

Expected: Pretty-printed JSON, no errors.

- [ ] **Step 3: Commit**

```bash
git add plugins/worktree-manager-memory-hook/hooks/hooks.json
git commit -m "feat: replace SessionStart with Setup hook in hooks.json"
```

---

### Task 2: Create setup.sh

**Files:**
- Create: `plugins/worktree-manager-memory-hook/scripts/setup.sh`

- [ ] **Step 1: Create setup.sh**

```bash
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
```

- [ ] **Step 2: Make executable**

Run: `chmod +x plugins/worktree-manager-memory-hook/scripts/setup.sh`

- [ ] **Step 3: Test setup.sh with a temporary settings.json**

```bash
# Create temp test environment
TMPDIR=$(mktemp -d)
mkdir -p "$TMPDIR/.claude"
echo '{"enabledPlugins":{}}' > "$TMPDIR/.claude/settings.json"

# Run setup with HOME overridden
HOME="$TMPDIR" bash plugins/worktree-manager-memory-hook/scripts/setup.sh "$(pwd)/plugins/worktree-manager-memory-hook"

# Verify output
python3 -m json.tool "$TMPDIR/.claude/settings.json"

# Verify uninstall.sh was copied
ls -la "$TMPDIR/.claude/worktree-memory-uninstall.sh"

# Verify idempotency — run again
HOME="$TMPDIR" bash plugins/worktree-manager-memory-hook/scripts/setup.sh "$(pwd)/plugins/worktree-manager-memory-hook"
python3 -c "
import json
with open('$TMPDIR/.claude/settings.json') as f:
    d = json.load(f)
hooks = d['hooks']['SessionStart']
print(f'SessionStart entries: {len(hooks)}')
assert len(hooks) == 1, 'Idempotency failed: multiple entries created'
print('Idempotency: PASS')
"

# Cleanup
rm -rf "$TMPDIR"
```

Expected:
- Valid JSON with `hooks.SessionStart` containing one entry
- `worktree-memory-uninstall.sh` exists
- Running twice still produces exactly 1 entry

- [ ] **Step 4: Commit**

```bash
git add plugins/worktree-manager-memory-hook/scripts/setup.sh
git commit -m "feat: add setup.sh to write SessionStart hook into settings.json"
```

---

### Task 3: Create uninstall.sh

**Files:**
- Create: `plugins/worktree-manager-memory-hook/scripts/uninstall.sh`

- [ ] **Step 1: Create uninstall.sh**

```bash
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
```

- [ ] **Step 2: Make executable**

Run: `chmod +x plugins/worktree-manager-memory-hook/scripts/uninstall.sh`

- [ ] **Step 3: Test uninstall.sh end-to-end**

```bash
# Create temp test environment and run setup first
TMPDIR=$(mktemp -d)
mkdir -p "$TMPDIR/.claude"
echo '{"enabledPlugins":{}}' > "$TMPDIR/.claude/settings.json"
HOME="$TMPDIR" bash plugins/worktree-manager-memory-hook/scripts/setup.sh "$(pwd)/plugins/worktree-manager-memory-hook"

# Verify hook exists
python3 -c "
import json
with open('$TMPDIR/.claude/settings.json') as f:
    d = json.load(f)
assert 'SessionStart' in d['hooks'], 'Setup failed'
print('Setup verified: SessionStart hook present')
"

# Run uninstall
HOME="$TMPDIR" bash "$TMPDIR/.claude/worktree-memory-uninstall.sh"

# Verify hook removed and hooks key cleaned up
python3 -c "
import json
with open('$TMPDIR/.claude/settings.json') as f:
    d = json.load(f)
assert 'hooks' not in d, f'hooks key should be removed, got: {d.get(\"hooks\")}'
print('Uninstall verified: hooks key removed')
"

# Verify uninstall script self-deleted
test ! -f "$TMPDIR/.claude/worktree-memory-uninstall.sh" && echo "Self-delete: PASS" || echo "Self-delete: FAIL"

# Cleanup
rm -rf "$TMPDIR"
```

Expected:
- Setup creates the hook
- Uninstall removes it and cleans up empty `hooks` key
- Uninstall script self-deletes

- [ ] **Step 4: Commit**

```bash
git add plugins/worktree-manager-memory-hook/scripts/uninstall.sh
git commit -m "feat: add uninstall.sh to remove SessionStart hook from settings.json"
```

---

### Task 4: Fix inject-context.ts .catch() error path

**Files:**
- Modify: `plugins/worktree-manager-memory-hook/scripts/inject-context.ts`

- [ ] **Step 1: Add display-to-user output to .catch()**

Replace the current `.catch()` block (lines 55-58):

```typescript
main().catch((err) => {
  fileLog(`Error: ${err.message}`);
  console.error("worktree-memory-hook error:", err.message);
});
```

With:

```typescript
main().catch((err) => {
  fileLog(`Error: ${err.message}`);
  console.log("<display-to-user>");
  console.log("[worktree-manager-memory] injected.");
  console.log("[worktree-manager-memory] total: 0 lines.");
  console.log("</display-to-user>");
});
```

- [ ] **Step 2: Test manually**

Run: `NONEXISTENT_IMPORT=1 bun run plugins/worktree-manager-memory-hook/scripts/inject-context.ts 2>&1`

Expected: Output should contain `<display-to-user>` block even if there's an error. (Normal run without error also works — the important thing is the `.catch` path now outputs the block.)

- [ ] **Step 3: Commit**

```bash
git add plugins/worktree-manager-memory-hook/scripts/inject-context.ts
git commit -m "fix: output display-to-user status in .catch() error path"
```

---

### Task 5: Version bumps

**Files:**
- Modify: `plugins/worktree-manager-memory-hook/package.json`
- Modify: `plugins/worktree-manager-memory-hook/.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Bump package.json version**

In `plugins/worktree-manager-memory-hook/package.json`, change:

```json
"version": "1.0.0",
```

To:

```json
"version": "2.0.0",
```

- [ ] **Step 2: Bump plugin.json version**

In `plugins/worktree-manager-memory-hook/.claude-plugin/plugin.json`, change:

```json
"version": "1.0.1",
```

To:

```json
"version": "2.0.0",
```

- [ ] **Step 3: Bump marketplace.json plugin version**

In `.claude-plugin/marketplace.json`, find the `worktree-manager-memory-hook` plugin entry and change:

```json
"version": "1.0.1",
```

To:

```json
"version": "2.0.0",
```

- [ ] **Step 4: Commit**

```bash
git add plugins/worktree-manager-memory-hook/package.json \
       plugins/worktree-manager-memory-hook/.claude-plugin/plugin.json \
       .claude-plugin/marketplace.json
git commit -m "chore: bump worktree-manager-memory-hook to v2.0.0"
```

---

### Task 6: Update README

**Files:**
- Modify: `plugins/worktree-manager-memory-hook/README.md`

- [ ] **Step 1: Rewrite README with updated install/uninstall instructions**

Replace the entire file:

```markdown
# worktree-manager-memory-hook

Auto-inject Memory Wiki context when entering a worktree-manager workspace via Claude Code.

## What it does

When you start a Claude Code session in a worktree-manager workspace, this plugin:

1. Detects the current worktree branch
2. Extracts the requirement ID from the branch name (e.g., `feature-27118` → `ERP-27118`)
3. Loads relevant context from `.vault/memory/`
4. Injects the context into Claude's prompt
5. Displays status: `[worktree-manager-memory] injected.` and `total: N lines.`

## Installation

### Via marketplace

```bash
claude plugin marketplace add guoyongchang/worktree-manager-obsidian-bridge
claude plugin install worktree-manager-obsidian-bridge@worktree-manager-memory-hook
```

The plugin's Setup hook automatically writes the SessionStart hook into `~/.claude/settings.json`. Restart Claude Code to activate.

### Via plugin-dir (development)

```bash
claude --plugin-dir /path/to/worktree-manager-memory-hook
# Then manually run setup:
bash /path/to/worktree-manager-memory-hook/scripts/setup.sh /path/to/worktree-manager-memory-hook
```

## Uninstall

```bash
# Remove the SessionStart hook from settings.json
bash ~/.claude/worktree-memory-uninstall.sh

# Then uninstall the plugin
claude plugin uninstall worktree-manager-obsidian-bridge@worktree-manager-memory-hook
```

## Requirements

- [Bun](https://bun.sh) runtime installed
- Python 3 (for setup/uninstall JSON manipulation)
- A worktree-manager workspace with `.vault/memory/` structure

## Memory Wiki structure

```
.vault/memory/
├── index.md           # Index of all memory entries
├── requirements/      # Requirement-specific context
│   ├── ERP-27118.md
│   └── ...
├── projects/          # Project-level context
│   └── my-project.md
└── log.md             # Activity log
```

## Branch naming conventions

The plugin extracts requirement IDs from these branch patterns:

- `feature-27118` → `ERP-27118`
- `fix-12345` → `ERP-12345`
- `feature/ABC-999` → `ABC-999`
- `bugfix/ABC-999` → `ABC-999`

## Debugging

Check the hook log:

```bash
tail -f /tmp/worktree-memory-hook.log
```

Check if the SessionStart hook is in settings.json:

```bash
python3 -c "import json; d=json.load(open('$HOME/.claude/settings.json')); print(json.dumps(d.get('hooks',{}), indent=2))"
```
```

- [ ] **Step 2: Commit**

```bash
git add plugins/worktree-manager-memory-hook/README.md
git commit -m "docs: update README with v2.0.0 install/uninstall instructions"
```

---

### Task 7: Integration test

No new files. Manual verification of the full flow.

- [ ] **Step 1: Run full setup → verify → uninstall cycle**

```bash
# Test setup with real settings.json (uses backup)
bash plugins/worktree-manager-memory-hook/scripts/setup.sh "$(pwd)/plugins/worktree-manager-memory-hook"

# Verify hook was written
python3 -c "
import json
with open('$HOME/.claude/settings.json') as f:
    d = json.load(f)
hooks = d.get('hooks', {}).get('SessionStart', [])
found = any('worktree-manager-memory-hook' in h.get('command', '') for entry in hooks for h in entry.get('hooks', []))
print(f'Hook installed: {found}')
assert found, 'Hook not found in settings.json'
"

# Verify backup was created
ls -la ~/.claude/settings.json.bak

# Verify uninstall script was copied
ls -la ~/.claude/worktree-memory-uninstall.sh
```

Expected: Hook present, backup exists, uninstall script copied.

- [ ] **Step 2: Test inject-context.ts runs correctly**

```bash
export PATH="$HOME/.bun/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
bun run plugins/worktree-manager-memory-hook/scripts/inject-context.ts 2>&1
```

Expected: Output contains `<display-to-user>` block with `[worktree-manager-memory] injected.` and `total: N lines.`

- [ ] **Step 3: Test uninstall**

```bash
bash ~/.claude/worktree-memory-uninstall.sh

# Verify hook removed
python3 -c "
import json
with open('$HOME/.claude/settings.json') as f:
    d = json.load(f)
hooks = d.get('hooks', {}).get('SessionStart', [])
found = any('worktree-manager-memory-hook' in h.get('command', '') for entry in hooks for h in entry.get('hooks', []))
print(f'Hook still present: {found}')
assert not found, 'Hook was not removed'
print('Uninstall: PASS')
"

# Verify self-delete
test ! -f ~/.claude/worktree-memory-uninstall.sh && echo "Self-delete: PASS" || echo "Self-delete: FAIL"
```

Expected: Hook removed, uninstall script self-deleted.

- [ ] **Step 4: Re-run setup to restore for actual use**

```bash
bash plugins/worktree-manager-memory-hook/scripts/setup.sh "$(pwd)/plugins/worktree-manager-memory-hook"
echo "Setup restored. Restart Claude Code to activate SessionStart hook."
```
