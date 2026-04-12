# Repo Agent Guide

This repository defines a reusable workspace restore and ingest workflow for Codex and Claude Code.

When editing this repo:

1. Read `README.md`
2. Read `skills/workspace-vault-maintainer/SKILL.md`
3. Read the relevant files under `skills/workspace-vault-maintainer/references/`
4. Read `commands/`

Rules:

- Keep the core workflow consistent across Codex and Claude Code
- Prefer declarative state over prose-only instructions
- Keep the skill concise and push detail into `references/`
- Update command prompts when the skill's behavior changes
- Validate the skill after modifying `SKILL.md` or `agents/openai.yaml`
