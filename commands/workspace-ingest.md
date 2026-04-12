# workspace-ingest

Use this prompt after meaningful work when you want the workspace wiki updated.

```text
Use $workspace-vault-maintainer to ingest new knowledge for the current workspace.

First identify the workspace, then read the workspace index, log, and ingest guidance. Inspect the recent changes, relevant repo docs, and any new constraints, commands, architecture changes, API changes, or debugging conclusions. Update only the most relevant workspace wiki pages, avoid duplication, and append a concise entry to the workspace log.

At the end, summarize:
- which wiki pages were updated
- what new knowledge was captured
- what still looks uncertain or inferred
```
