---
name: workspace-vault-maintainer
description: Use when working from a workspace root that is backed by a Vault or Obsidian wiki and you need to restore local runtime files, rebuild a `.vault/` linked-docs layer, match the workspace through a registry, or ingest durable knowledge back into the right workspace wiki pages after meaningful work.
---

# Workspace Vault Maintainer

## Overview

This skill maintains a two-way workflow between a local workspace runtime and a Vault-backed workspace wiki.

Use it for two related jobs:

- `restore`: rebuild or repair the local workspace runtime from the Vault-backed definition
- `ingest`: update the workspace wiki after new durable knowledge appears during work

This skill is designed to support both Codex and Claude Code. Keep the shared workspace model consistent, and treat tool-specific plugin behavior as an implementation detail.

## When To Use This Skill

Use this skill when one or more of these are true:

- you are standing in a workspace root, not just a single repo
- the workspace uses a Vault or Obsidian wiki as the source of truth
- the workspace has local runtime files such as `AGENTS.md`, `CLAUDE.md`, `.ai/*`, or `.vault/`
- you need to restore a missing or stale `.vault/` linked-docs layer
- you need to identify which workspace definition in the Vault matches the current directory
- you need to update the workspace wiki after meaningful implementation, debugging, review, or architecture work

## Workflow Decision

1. Identify the current workspace
2. Find structured state first
3. Decide whether this is `restore` or `ingest`
4. Touch only the minimum useful pages or runtime files
5. Report what changed and what still needs confirmation

Prefer declared state over guesswork:

- workspace registry
- local `.ai/desired-state.json`
- local `.ai/restore.md`
- local `.vault/`
- workspace `index.md`, `log.md`, `ingest.md`

## Restore Workflow

Use restore when the local runtime is missing, stale, or incomplete.

Restore checklist:

1. Identify the workspace from the current directory and registry
2. Load the workspace definition from the Vault
3. Check local runtime files such as:
   - `AGENTS.md`
   - `CLAUDE.md`
   - `.ai/restore.md`
   - `.ai/desired-state.json`
   - `.ai/bootstrap-prompt.md`
   - `.ai/local-overrides.example.json`
4. Rebuild or repair the local `.vault/` linked-docs layer
5. Restore declared Claude Code, Codex, skill, and MCP expectations
6. Summarize the result

Full restore should normally create or repair `.vault/`. If `.vault/` is not restored, call that out as incomplete unless the user explicitly asked for a lightweight setup.

For detailed restore rules, read [references/restore-workflow.md](references/restore-workflow.md).

## Ingest Workflow

Use ingest when the work produced durable knowledge that future sessions should remember.

Typical ingest triggers:

- architecture changes
- new constraints or invariants
- new dev, build, or release commands
- API changes
- debugging conclusions that future sessions would benefit from
- changes to workspace structure or repo roles

Ingest checklist:

1. Read the workspace `index.md`, `log.md`, and `ingest.md`
2. Inspect the recent work and relevant source material
3. Update only the most relevant wiki pages
4. Avoid duplicating existing content
5. Append a concise entry to the workspace `log.md`

For detailed ingest rules, read [references/ingest-workflow.md](references/ingest-workflow.md).

## Claude Code And Codex

The shared workspace model should stay the same across both tools:

- same workspace identification
- same Vault-backed source of truth
- same `.vault/` linked-docs layer
- same ingest targets

Tool-specific differences:

- Claude Code usually needs plugin enablement and project MCP checks
- Codex usually needs project plugin declarations, skills, marketplace, or local plugin surfaces

For the structured state model, read [references/registry-schema.md](references/registry-schema.md).

## Output Style

- reply in the user's preferred language
- keep summaries short and structured
- clearly distinguish confirmed facts from inference
- separate restore results from ingest results
