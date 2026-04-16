# worktree-manager-memory-hook

Auto-inject Memory Wiki context when entering a worktree-manager workspace via Claude Code.

## What it does

When you start a Claude Code session in a worktree-manager workspace, this plugin:

1. Detects the current worktree branch
2. Extracts the requirement ID from the branch name (e.g., `feature-27118` → `ERP-27118`)
3. Loads relevant context from `.vault/memory/`
4. Injects the context into Claude's prompt
5. Displays status: `[worktree-manager-memory] injected.` and `total: N lines.`

The plugin now uses Claude Code's native plugin `SessionStart` hook. Its `Setup` hook is retained only for environment checks.
The plugin does not modify `~/.claude/settings.json`.

## Installation

### Via marketplace

```bash
claude plugin marketplace add guoyongchang/worktree-manager-obsidian-bridge
claude plugin install worktree-manager-memory-hook@worktree-manager-obsidian-bridge
```

If you just enabled the plugin, start a new Claude Code session so the native `SessionStart` hook is active.

### Via plugin-dir (development)

```bash
claude --plugin-dir /path/to/worktree-manager-memory-hook
```

## Uninstall

```bash
claude plugin uninstall worktree-manager-memory-hook@worktree-manager-obsidian-bridge
```

## Requirements

- [Bun](https://bun.sh) runtime installed
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

Validate the plugin manifest locally:

```bash
claude plugin validate /path/to/worktree-manager-memory-hook
```

## Archive (conversation → memory queue)

When a Claude Code session ends or context is compacted, this plugin automatically:

1. Reads the session JSONL file
2. Strips noise (thinking, tool calls, system tags)
3. POSTs the clean conversation to worktree-manager's memory queue

### Hooks

| Hook | Trigger | Purpose |
|------|---------|---------|
| SessionStart | Session begins | Inject memory context |
| PreCompact | Before context compaction | Archive conversation before context is lost |
| SessionEnd | Session exits | Archive complete conversation |

### Manual trigger

Use `/memory-sync` in any Claude Code session to manually submit the current conversation to the archive queue.

### Configuration

Default config at `config/memory-hook.config.json`:

```json
{
  "worktreeManager": {
    "endpoint": "http://localhost:9399"
  },
  "archive": {
    "autoOnSessionEnd": true
  }
}
```

Override per-workspace by creating `.vault/memory-hook.config.json` with the same structure.

### Archive logs

```bash
tail -f /tmp/worktree-memory-archive.log
```
