#!/usr/bin/env bun
/**
 * Query requirement-docs for the current worktree.
 *
 * Reads: {cwd}/requirement-docs/{branch}/README.md
 */

import * as path from "path";
import * as fs from "fs";
import type { WorktreeInfo } from "./detect-worktree";

export interface MemoryResult {
  requirementDoc?: {
    path: string;
    content: string;
  };
}

/**
 * Read a file safely.
 */
function readFile(filePath: string): string | undefined {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  } catch {
    // Ignore errors
  }
  return undefined;
}

/**
 * Query the requirement-docs directory for the current worktree.
 */
export async function queryMemory(worktree: WorktreeInfo): Promise<MemoryResult> {
  const result: MemoryResult = {};

  const branch = worktree.branch || path.basename(worktree.cwd);
  if (!branch) {
    return result;
  }

  const reqDocsDir = path.join(worktree.cwd, "requirement-docs", branch);
  const candidates = ["plan.md", "README.md", "design.md"];

  for (const candidate of candidates) {
    const docPath = path.join(reqDocsDir, candidate);
    const content = readFile(docPath);
    if (content) {
      result.requirementDoc = { path: docPath, content };
      break;
    }
  }

  return result;
}

// CLI entry point for testing
if (import.meta.main) {
  const { detectWorktree } = await import("./detect-worktree");
  const worktree = await detectWorktree(process.cwd());

  if (worktree) {
    const memory = await queryMemory(worktree);
    if (memory.requirementDoc) {
      console.log(`Found: ${memory.requirementDoc.path}`);
      console.log("---");
      console.log(memory.requirementDoc.content);
    } else {
      console.log("No requirement doc found");
    }
  } else {
    console.log("Not in a worktree-manager workspace");
  }
}
