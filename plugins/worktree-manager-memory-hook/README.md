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
