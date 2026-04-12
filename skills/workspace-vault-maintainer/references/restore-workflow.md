# Restore Workflow

## Goal

Restore a workspace runtime from a Vault-backed workspace definition.

## Preferred discovery order

1. Current directory
2. Local runtime files
3. Workspace registry
4. Workspace wiki pages
5. Machine-local overrides

## Full restore expectations

A full restore should normally:

- identify the workspace from the registry
- load the matching Vault workspace definition
- restore or repair local runtime files
- restore or repair the local `.vault/` linked-docs layer
- link the declared workspace files and directories into `.vault/`
- restore declared Claude Code, Codex, skills, and MCP expectations

## Incomplete restore

Unless the user explicitly asked for a lighter setup, restore is incomplete when:

- `.vault/` is missing
- linked workspace directories are missing
- local runtime files contradict the registry or workspace definition

## Local runtime files

Typical files:

- `AGENTS.md`
- `CLAUDE.md`
- `.ai/restore.md`
- `.ai/desired-state.json`
- `.ai/bootstrap-prompt.md`
- `.ai/local-overrides.example.json`
- optional `.ai/local-overrides.json`
- optional `.ai/plugins.json`
- optional `.ai/skills.json`
- optional `.ai/mcp.servers.json`

## Tool-specific restore

### Claude Code

- inspect `.claude/settings.json` when present
- inspect `.mcp.json` when present
- restore declared plugin enablement expectations
- restore declared project MCP expectations

### Codex

- inspect `.agents/plugins/marketplace.json` when present
- inspect project plugin surfaces such as `plugins/`, `skills/`, and manifests
- restore declared plugin discovery state

## Reporting

At the end of restore, report:

- what was created
- what was repaired
- what was restored for Claude Code
- what was restored for Codex
- what still needs manual confirmation
