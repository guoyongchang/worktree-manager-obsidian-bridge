# workspace-restore

Use this prompt from a workspace root when you want a full restore from a Vault-backed wiki.

```text
Use $workspace-vault-maintainer to restore this workspace.

First identify the workspace from the current directory and any declared registry or local runtime files. Then load the Vault-backed workspace definition, confirm the matching workspace, and perform a full restore.

Full restore means:
- restore or repair local runtime files
- create or repair the local .vault linked-docs layer
- restore declared Claude Code, Codex, skills, and MCP expectations
- prefer declarative workspace state over guessing

Before editing, show a short plan. After restore, summarize:
- what was created
- what was repaired
- what was restored for Claude Code
- what was restored for Codex
- what still needs manual confirmation
```
