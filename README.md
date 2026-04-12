# worktree-manager-obsidian-bridge

Bridge `worktree-manager`-style workspaces with an Obsidian-backed AI wiki for Claude Code and Codex.

This repo packages a reusable workflow for:

- restoring a workspace from a Vault-backed wiki
- maintaining a local `.vault/` linked-docs layer
- declaring expected Claude Code, Codex, skills, and MCP state
- ingesting new knowledge back into the right workspace wiki pages

## What is in this repo

- `skills/workspace-vault-maintainer/`
  The core skill for restore and ingest workflows

- `commands/workspace-restore.md`
  A reusable command/prompt entry for full workspace restore

- `commands/workspace-ingest.md`
  A reusable command/prompt entry for wiki ingest after meaningful work

- `AGENTS.md` and `CLAUDE.md`
  Repo-local instructions for maintaining this project itself

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

Claude Code does not consume Codex skills directly in the same way, so the recommended pattern is:

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

## Current focus

The first version targets `worktree-manager`-style multi-repo workspace roots backed by an Obsidian Vault wiki. The abstractions are intentionally generic enough to extend to other workspace layouts later.
