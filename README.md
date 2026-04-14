# worktree-manager-obsidian-bridge

Bridge `worktree-manager`-style workspaces with an Obsidian-backed AI wiki for Claude Code and Codex.

This repo packages a reusable workflow for:

- restoring a workspace from a Vault-backed wiki
- maintaining a local `.vault/` linked-docs layer
- declaring expected Claude Code, Codex, skills, and MCP state
- ingesting new knowledge back into the right workspace wiki pages
- **auto-injecting Memory Wiki context on session start** (v1.1.0+)

## What is in this repo

- `skills/workspace-vault-maintainer/`
  The core skill for restore and ingest workflows

- `commands/workspace-restore.md`
  A reusable command/prompt entry for full workspace restore

- `commands/workspace-ingest.md`
  A reusable command/prompt entry for wiki ingest after meaningful work

- `hooks/hooks.json`
  SessionStart hook for auto-injecting Memory Wiki context

- `scripts/`
  TypeScript scripts for worktree detection and context injection

- `AGENTS.md` and `CLAUDE.md`
  Repo-local instructions for maintaining this project itself

- `.claude-plugin/plugin.json`
  A native Claude Code plugin manifest for local plugin discovery

- `.claude-plugin/marketplace.json`
  A native Claude Code marketplace catalog for installing the plugin from GitHub

## Intended workflow

1. Stand in a workspace root
2. Restore the workspace from the Vault-backed wiki
3. Do the actual work
4. Ingest durable knowledge back into the workspace wiki

## Design principles

- The Vault is the source of truth for workspace knowledge
- The local workspace is the runtime location
- Full restore should create a local `.vault/` linked-docs layer
- Restore and ingest should be declarative when possible
- Claude Code and Codex should share the same mental model even when their plugin models differ

## Installation

### Codex

Clone this repo somewhere stable, then expose the skill through your normal Codex skill discovery path.

Example:

```bash
git clone https://github.com/guoyongchang/worktree-manager-obsidian-bridge.git ~/worktree-manager-obsidian-bridge
mkdir -p ~/.agents/skills
ln -s ~/worktree-manager-obsidian-bridge/skills/workspace-vault-maintainer ~/.agents/skills/workspace-vault-maintainer
```

After that, Codex can discover the skill as `workspace-vault-maintainer`.

### Claude Code

This repo ships:

- `.claude-plugin/plugin.json` for local plugin discovery
- `.claude-plugin/marketplace.json` for Claude marketplace distribution

It keeps plugin components in the standard plugin-root locations:

- `skills/`
- `commands/`

For development and local testing, use the official plugin-dir flow:

```bash
claude --plugin-dir /path/to/worktree-manager-obsidian-bridge
```

The local plugin namespace is:

```text
worktree-manager-obsidian-bridge
```

So plugin-scoped skills and commands will appear with that namespace in Claude Code.

For marketplace installation from GitHub, add the marketplace and then install the plugin:

```bash
claude plugin marketplace add guoyongchang/worktree-manager-obsidian-bridge
claude plugin install worktree-manager-obsidian-bridge@worktree-manager-obsidian-bridge
```

For a team project, you can also declare the marketplace and plugin in `.claude/settings.json` so Claude Code can restore them automatically at project scope.

Claude Code and Codex do not consume skills in exactly the same way, so the recommended shared pattern is:

- reuse `commands/workspace-restore.md` as the restore launcher prompt
- reuse `commands/workspace-ingest.md` as the ingest launcher prompt
- reuse the same Vault workflow, workspace registry, and `.vault/` linked-docs model

If you maintain Claude project instructions, adapt the workflow from:

- `skills/workspace-vault-maintainer/SKILL.md`
- `commands/workspace-restore.md`
- `commands/workspace-ingest.md`

## Usage

### Restore

From a workspace root, invoke the restore command or equivalent prompt and use `workspace-vault-maintainer` to:

- identify the workspace
- load registry-backed workspace state
- rebuild `.vault/`
- repair local runtime files

### Ingest

After meaningful work, invoke the ingest command or equivalent prompt and use `workspace-vault-maintainer` to:

- identify the workspace
- read the index, log, and ingest guidance
- update the right wiki pages
- append a concise log entry

## Compatibility

### Codex native

- `skills/workspace-vault-maintainer/SKILL.md`
- `agents/openai.yaml`
- references under `skills/workspace-vault-maintainer/references/`

### Claude Code native

- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- plugin-root `skills/`
- plugin-root `commands/`

This repo is intended to be:

- a native Codex skill package
- a native Claude Code local plugin directory
- a native Claude Code marketplace catalog
- a shared workflow definition for both tools

## Memory Wiki Auto-Injection (v1.1.0+)

When you start a Claude Code session in a worktree, the plugin automatically:

1. Detects if you're in a worktree-manager workspace
2. Extracts the branch name and maps it to a requirement ID (e.g., `feature-27118` -> `ERP-27118`)
3. Loads the relevant requirement page from `.vault/memory/requirements/`
4. Injects the context into the conversation

Example output on session start:

```
[worktree-memory] 4/14/2026, 11:26:13 PM
──────────────────────────────────────────────────
Branch: feature-27118
Requirement: ERP-27118
Memory loaded: requirements/ERP-27118.md
──────────────────────────────────────────────────
```

### Memory Wiki Structure

The Memory Wiki follows the LLM Wiki model (Karpathy):

```
.vault/memory/
├── index.md          # Search index
├── log.md            # Activity log
├── schema.md         # Structure rules
├── requirements/     # Requirement pages (ERP-XXXXX.md)
├── projects/         # Project pages
└── concepts/         # Reusable concept pages
```

### Branch-to-Requirement Mapping

The plugin supports multiple branch naming patterns:

- `feature-27118` -> `ERP-27118`
- `fix-27118` -> `ERP-27118`
- `ERP-27118-xxx` -> `ERP-27118`
- `hotfix-27118` -> `ERP-27118`

## Current focus

The first version targets `worktree-manager`-style multi-repo workspace roots backed by an Obsidian Vault wiki. The abstractions are intentionally generic enough to extend to other workspace layouts later.
