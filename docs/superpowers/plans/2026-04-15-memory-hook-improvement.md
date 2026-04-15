# Memory-Hook Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `worktree-manager-memory-hook` to a native Claude Code plugin `SessionStart` hook while keeping a lightweight `Setup` check.

**Architecture:** `plugins/worktree-manager-memory-hook/hooks/hooks.json` declares both `Setup` and `SessionStart`. `SessionStart` directly runs `scripts/inject-context.ts` via `${CLAUDE_PLUGIN_ROOT}`. `scripts/setup.sh` only validates basic runtime readiness and prints diagnostics; it does not modify `~/.claude/settings.json`.

**Tech Stack:** Bash, Bun, TypeScript, Claude Code plugin manifests

**Spec:** `docs/superpowers/specs/2026-04-15-memory-hook-improvement-design.md`

**Status:** Completed on 2026-04-15. The checklist below is retained as the historical execution plan for this implementation, not as an open task list.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `plugins/worktree-manager-memory-hook/hooks/hooks.json` | Modify | Declare native `Setup` and `SessionStart` hooks |
| `plugins/worktree-manager-memory-hook/scripts/setup.sh` | Modify | Print setup diagnostics and Bun readiness warning |
| `plugins/worktree-manager-memory-hook/README.md` | Modify | Document native install/runtime behavior |
| `plugins/worktree-manager-memory-hook/tests/native-sessionstart.sh` | Create | Verify native `SessionStart` config and `setup.sh` no-op behavior |

---

### Task 1: Switch hook ownership to the plugin

**Files:**
- Modify: `plugins/worktree-manager-memory-hook/hooks/hooks.json`

- [ ] **Step 1: Write the failing test**

```bash
plugins/worktree-manager-memory-hook/tests/native-sessionstart.sh
```

Expected: FAIL because `SessionStart` is not declared in plugin `hooks.json`, or because `setup.sh` still mutates `settings.json`.

- [ ] **Step 2: Add native `SessionStart` to `hooks.json`**

```json
{
  "description": "Native SessionStart context injection for worktree-manager workspaces.",
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
    ],
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "export PATH=\"$HOME/.bun/bin:/usr/local/bin:/opt/homebrew/bin:$PATH\"; bun run \"${CLAUDE_PLUGIN_ROOT}/scripts/inject-context.ts\" 2>&1",
            "timeout": 10000
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 3: Run the test again**

Run: `plugins/worktree-manager-memory-hook/tests/native-sessionstart.sh`

Expected: Still FAIL until `setup.sh` stops mutating `settings.json`.

---

### Task 2: Make `setup.sh` a lightweight check

**Files:**
- Modify: `plugins/worktree-manager-memory-hook/scripts/setup.sh`

- [ ] **Step 1: Replace mutation logic with diagnostics**

```bash
#!/usr/bin/env bash
set -euo pipefail

MARKER="worktree-manager-memory-hook"

if [ -z "${1:-}" ]; then
  echo "[${MARKER}] ERROR: CLAUDE_PLUGIN_ROOT not provided." >&2
  exit 1
fi

PLUGIN_ROOT="$(cd "$1" && pwd)"
echo "[${MARKER}] native SessionStart hook is bundled with the plugin."
echo "[${MARKER}] plugin root: $PLUGIN_ROOT"

if ! command -v bun >/dev/null 2>&1; then
  echo "[${MARKER}] WARNING: bun was not found in PATH. SessionStart will fail until bun is installed." >&2
fi

echo "[${MARKER}] setup complete. Start a new Claude Code session if this plugin was just enabled."
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `plugins/worktree-manager-memory-hook/tests/native-sessionstart.sh`

Expected: PASS with `native SessionStart validation passed`

---

### Task 3: Align docs with the native model

**Files:**
- Modify: `plugins/worktree-manager-memory-hook/README.md`

- [ ] **Step 1: Update install/runtime docs**

Ensure README states:

- install command uses `worktree-manager-memory-hook@worktree-manager-obsidian-bridge`
- the plugin uses native `SessionStart`
- the plugin does not modify `~/.claude/settings.json`
- uninstall is just `claude plugin uninstall ...`

- [ ] **Step 2: Validate the plugin docs against the manifests**

Run: `claude plugin validate plugins/worktree-manager-memory-hook`

Expected: `Validation passed`

---

### Task 4: Add a regression check for the new behavior

**Files:**
- Create: `plugins/worktree-manager-memory-hook/tests/native-sessionstart.sh`

- [ ] **Step 1: Add a shell-based regression test**

The test should assert:

- `hooks.json` contains both `Setup` and `SessionStart`
- `SessionStart` points to `inject-context.ts`
- `SessionStart` uses `${CLAUDE_PLUGIN_ROOT}`
- `setup.sh` does not change a temporary `settings.json`
- `setup.sh` does not create `worktree-memory-uninstall.sh`

- [ ] **Step 2: Run the regression test**

Run: `plugins/worktree-manager-memory-hook/tests/native-sessionstart.sh`

Expected: `native SessionStart validation passed`

---

### Task 5: Final verification

**Files:**
- Verify: `plugins/worktree-manager-memory-hook/hooks/hooks.json`
- Verify: `plugins/worktree-manager-memory-hook/scripts/setup.sh`
- Verify: `plugins/worktree-manager-memory-hook/README.md`
- Verify: `plugins/worktree-manager-memory-hook/tests/native-sessionstart.sh`

- [ ] **Step 1: Validate plugin and marketplace manifests**

Run: `claude plugin validate plugins/worktree-manager-memory-hook && claude plugin validate .`

Expected:

- `Validation passed` for plugin manifest
- `Validation passed` for marketplace manifest

- [ ] **Step 2: Verify the runtime entrypoint still executes**

Run: `bun run plugins/worktree-manager-memory-hook/scripts/inject-context.ts`

Expected:

```text
<display-to-user>
[worktree-manager-memory] injected.
[worktree-manager-memory] total: 0 lines.
</display-to-user>
```
