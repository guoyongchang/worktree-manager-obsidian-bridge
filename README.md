# worktree-manager-obsidian-bridge

Claude Code plugin for [worktree-manager](https://github.com/guoyongchang/worktree-manager) workspaces.

Provides **context injection**, **conversation archiving**, and **Memory Wiki organization** — all local, no external queue.

## What it does

### 1. SessionStart: Inject requirement context

When entering a worktree, reads `requirement-docs/{branch}/README.md` and injects it into Claude's system prompt:

```xml
<worktree-requirement-doc>
<!-- Source: /path/to/requirement-docs/feature-27118/README.md -->
[content]
</worktree-requirement-doc>
```

Nothing else is injected — no memory wiki pages, no project context, no staging state. Just the current worktree's requirement doc.

### 2. SessionEnd / PreCompact: Archive to staging

At session end or compaction, reads the session JSONL, extracts the `{role, content}` conversation, and writes:

```
.memory-staging/session-{timestamp}-{sessionId}.json
```

Format is compatible with the organizer pipeline (see below).

### 3. /memory-sync — Manual archive trigger

Users can run `/memory-sync` anytime to immediately archive the current conversation to staging.

### 4. /memory-archive — Run finalize

Users can run `/memory-archive` to execute the finalize pipeline, which:
1. Reads `.memory-staging/organized/*.md` summaries
2. Reads current `memory/` wiki state
3. Calls LLM to generate file operations
4. Applies them to `memory/` (updates requirements, projects, index, log)
5. Cleans up staging on success

**Prerequisite:** Run `--accumulate` first (see below).

### 5. Built-in organizer (accumulate + finalize)

The plugin embeds `scripts/organizer/` — a two-phase LLM pipeline:

| Phase | Command | Model | Input | Output |
|-------|---------|-------|-------|--------|
| **accumulate** | `bun run scripts/organizer/index.ts --accumulate` | gpt-4o-mini | `.memory-staging/*.json` | `.memory-staging/organized/*.md` |
| **finalize** | `/memory-archive` or `--finalize` | gpt-5.4 | organized + `memory/` state | Updated `memory/` wiki |

```bash
# Step 1: accumulate (cheap, run manually or on CI)
export OPENAI_API_KEY="..."
bun run "${CLAUDE_PLUGIN_ROOT}/scripts/organizer/index.ts" \
  --accumulate --staging .memory-staging --config .memory-organizer.config.json

# Step 2: finalize (via /memory-archive skill, or manually)
bun run "${CLAUDE_PLUGIN_ROOT}/scripts/organizer/index.ts" \
  --finalize --staging .memory-staging --memory memory --config .memory-organizer.config.json
```

### 6. Vault restore/ingest (legacy skill)

`skills/workspace-vault-maintainer/` provides Obsidian Vault restore and ingest workflows. This was the original purpose of this repo; the memory hook features have since become the primary use case.

## Architecture

```
Claude Code Session
  ├── SessionStart  → inject-context.ts → requirement-docs/{branch}/README.md
  ├── SessionEnd    → archive-memory.ts → .memory-staging/session-XXX.json
  ├── PreCompact    → archive-memory.ts → .memory-staging/session-XXX.json
  ├── /memory-sync  → archive-memory.ts --trigger=manual
  └── /memory-archive → organizer/index.ts --finalize
```

All data stays local:
- Staging: `.memory-staging/` in worktree root
- Wiki: `memory/` in Vault root
- Config: `.memory-organizer.config.json` in worktree root

## Installation

### Marketplace

```bash
claude plugin marketplace add guoyongchang/worktree-manager-obsidian-bridge
claude plugin install worktree-manager-memory-hook@worktree-manager-obsidian-bridge
```

Or declare in `.claude/settings.json`:

```json
{
  "enabledPlugins": {
    "worktree-manager-memory-hook@worktree-manager-obsidian-bridge": true
  }
}
```

### Local development

```bash
git clone https://github.com/guoyongchang/worktree-manager-obsidian-bridge.git
claude --plugin-dir /path/to/worktree-manager-obsidian-bridge
```

## Configuration

### `.memory-organizer.config.json` (worktree root)

```json
{
  "llm": {
    "accumulate": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "api_key_env": "OPENAI_API_KEY",
      "base_url": "https://api.openai.com"
    },
    "finalize": {
      "provider": "openai",
      "model": "gpt-5.4",
      "api_key_env": "OPENAI_API_KEY",
      "base_url": "https://api.openai.com"
    }
  }
}
```

### `hooks/hooks.json` (plugin-scoped)

Registered hooks:

| Hook | Script | When |
|------|--------|------|
| Setup | `setup.sh` | Plugin install |
| SessionStart | `inject-context.ts` | Every directory change |
| PreCompact | `archive-memory.ts --trigger=pre-compact` | Context compaction |
| SessionEnd | `archive-memory.ts --trigger=session-end` | Session ends |

## File layout

```
.claude-plugin/
  plugin.json              # Plugin manifest
  marketplace.json         # Marketplace catalog
commands/
  workspace-restore.md     # Vault restore prompt
  workspace-ingest.md      # Vault ingest prompt
hooks/
  hooks.json               # Hook definitions
scripts/
  archive-memory.ts        # JSONL → staging writer
  build-context.ts         # Context string builder
  detect-worktree.ts       # Worktree detection
  inject-context.ts        # SessionStart entry
  query-memory.ts          # Requirement doc reader
  archive/                 # (legacy HTTP client, unused)
  organizer/               # Built-in accumulate + finalize
    commands/
      accumulate.ts
      finalize.ts
    llm/
      client.ts
    memory/
      reader.ts
      writer.ts
    prompts/
      accumulate.md
      finalize.md
    config.ts
    index.ts
    types.ts
skills/
  memory-sync/             # /memory-sync skill
  memory-archive/          # /memory-archive skill
  workspace-vault-maintainer/  # Vault restore skill
```

## Changelog

### v2.2.2
- Merge `vault-memory-organizer` into plugin (`scripts/organizer/`)
- Update `/memory-archive` skill to use embedded organizer

### v2.2.1
- Simplify inject to only `requirement-docs/{branch}/README.md`
- Remove memory wiki injection (requirements, projects, concepts, staging)

### v2.2.0
- Replace HTTP queue with local `.memory-staging/` archive
- Add `/memory-archive` skill
- Update `/memory-sync` for local staging workflow

### v2.1.x
- Memory queue backend with worktree-manager App integration

## License

MIT
