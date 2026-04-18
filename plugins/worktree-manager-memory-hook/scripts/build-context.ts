#!/usr/bin/env bun
/**
 * Build the context string to inject into Claude's prompt.
 * Only injects the requirement-doc README.md if it exists.
 */

import type { WorktreeInfo } from "./detect-worktree";
import type { MemoryResult } from "./query-memory";

/**
 * Build the full context string
 */
export function buildContext(worktree: WorktreeInfo, memory: MemoryResult): string {
  if (!memory.requirementDoc) {
    return "";
  }

  const parts: string[] = [];

  parts.push("<worktree-requirement-doc>");
  parts.push("");
  parts.push(`<!-- Source: ${memory.requirementDoc.path} -->`);
  parts.push("");
  parts.push(memory.requirementDoc.content);
  parts.push("");
  parts.push("</worktree-requirement-doc>");

  return parts.join("\n");
}

// CLI entry point for testing
if (import.meta.main) {
  const { detectWorktree } = await import("./detect-worktree");
  const { queryMemory } = await import("./query-memory");

  const worktree = await detectWorktree(process.cwd());

  if (worktree) {
    const memory = await queryMemory(worktree);
    const context = buildContext(worktree, memory);
    if (context) {
      console.log(context);
    } else {
      console.log("No requirement doc to inject");
    }
  } else {
    console.log("Not in a worktree-manager workspace");
  }
}
