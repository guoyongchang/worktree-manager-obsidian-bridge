# Registry Schema Notes

The workspace registry is the first structured source of truth for known workspaces.

## Recommended fields

- `id`
- `name`
- `vaultWorkspacePath`
- `kind`
- `knownLocalRoots`
- `primaryRepos`
- `linkedVaultFiles`
- `linkedVaultDirectories`
- `expectedStateFiles`
- `claude`
- `codex`
- `skills`
- `mcp`
- `notes`

## Why the registry matters

Without a registry, restore and ingest rely too heavily on prose and heuristic matching.

With a registry, the workflow can:

- identify a workspace from the current directory
- know which files and directories belong in `.vault/`
- know which runtime files should exist
- know which Claude Code and Codex expectations to check

## Local roots

`knownLocalRoots` is especially useful when a workspace has been moved or renamed locally. It reduces ambiguity during restore and ingest.
