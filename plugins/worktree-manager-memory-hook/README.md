# worktree-manager-memory-hook

Auto-inject Memory Wiki context when entering a worktree-manager workspace via Claude Code hooks.

## What it does

When you start a Claude Code session in a worktree-manager workspace, this plugin:

1. Detects the current worktree branch
2. Extracts the requirement ID from the branch name (e.g., `feature-27118` → `ERP-27118`)
3. Loads relevant context from `.vault/memory/`
4. Injects the context into Claude's prompt

## Installation

### Via marketplace

```bash
claude plugin marketplace add guoyongchang/worktree-manager-obsidian-bridge
claude plugin install worktree-manager-obsidian-bridge@worktree-manager-memory-hook
```

### Via plugin-dir (development)

```bash
claude --plugin-dir /path/to/worktree-manager-memory-hook
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
