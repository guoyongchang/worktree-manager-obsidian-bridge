# Ingest Workflow

## Goal

Move durable knowledge from active work into the right workspace wiki pages.

## Typical inputs

- code changes
- repo docs
- requirement docs
- architecture discoveries
- debugging conclusions
- review findings
- workflow or command changes

## Read order before writing

1. workspace `index.md`
2. workspace `log.md`
3. workspace `WORKSPACE.md`
4. the most relevant topic page
5. local repo material related to the recent work

## Page selection

- `architecture/` for system design or structural changes
- `features/` for behavior and workflow changes
- `development/` for commands, setup, validation, or release flow
- `api/` for interface changes
- `reference/` for schemas, config, and stable reference material
- `claude-reference/` for agent-facing heuristics and reading guidance

## Writing rules

- prefer incremental updates
- avoid repeating what is already written
- keep durable knowledge, not chat residue
- mark inferences clearly
- update the smallest set of pages that captures the new information well

## Log update

If ingest changed meaningful content, append a short entry to `log.md` with:

- date
- pages updated
- reason
- any uncertainty that remains
