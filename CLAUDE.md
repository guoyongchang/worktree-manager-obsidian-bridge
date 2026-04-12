# Claude Guide

This repo packages a Vault-backed workspace restore and ingest workflow.

Start here:

1. `README.md`
2. `.claude-plugin/plugin.json`
3. `.claude-plugin/marketplace.json`
4. `skills/workspace-vault-maintainer/SKILL.md`
5. `skills/workspace-vault-maintainer/references/`
6. `commands/workspace-restore.md`
7. `commands/workspace-ingest.md`

When maintaining this repo:

- keep the workflow compatible with both Claude Code and Codex
- keep the Claude plugin manifest and plugin-root component layout valid
- keep the Claude marketplace manifest valid and consistent with the published GitHub source
- preserve the distinction between restore and ingest
- keep `.vault/` as a required part of full restore
- prefer incremental refinement over rewriting the entire skill
