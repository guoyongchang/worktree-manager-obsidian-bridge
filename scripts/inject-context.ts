#!/usr/bin/env bun
/**
 * Main entry point for the SessionStart hook.
 * Detects current worktree, queries Memory Wiki, and outputs context to inject.
 */

import { detectWorktree, type WorktreeInfo } from "./detect-worktree";
import { queryMemory, type MemoryResult } from "./query-memory";
import { buildContext } from "./build-context";

// ANSI color codes for styled output
const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  bold: "\x1b[1m",
};

function log(message: string) {
  // Output to stderr for visibility in Claude UI
  console.error(message);
}

function formatBanner(worktree: WorktreeInfo, memory: { requirement: any; project: any }) {
  const lines: string[] = [];
  const now = new Date().toLocaleString();

  lines.push("");
  lines.push(`${colors.cyan}${colors.bold}[worktree-memory]${colors.reset} ${colors.dim}${now}${colors.reset}`);
  lines.push(`${colors.dim}${"─".repeat(50)}${colors.reset}`);

  if (worktree.branch) {
    lines.push(`${colors.green}Branch:${colors.reset} ${worktree.branch}`);
  }

  if (worktree.requirementId) {
    lines.push(`${colors.yellow}Requirement:${colors.reset} ${worktree.requirementId}`);
  }

  if (memory.requirement) {
    lines.push(`${colors.blue}Memory loaded:${colors.reset} requirements/${memory.requirement.id}.md`);
  }

  if (memory.project) {
    lines.push(`${colors.magenta}Project context:${colors.reset} projects/${memory.project.name}.md`);
  }

  lines.push(`${colors.dim}${"─".repeat(50)}${colors.reset}`);
  lines.push("");

  return lines.join("\n");
}

async function main() {
  try {
    // 1. Detect current worktree
    const worktree = await detectWorktree(process.cwd());

    if (!worktree) {
      // Not in a worktree-manager workspace, skip injection
      log(`${colors.dim}[worktree-memory] Not in a worktree-manager workspace${colors.reset}`);
      return;
    }

    // 2. Query Memory Wiki for relevant content
    const memory = await queryMemory(worktree);

    if (!memory.requirement && !memory.project) {
      // No relevant memory found, skip injection
      log(`${colors.dim}[worktree-memory] No memory found for ${worktree.branch || "current worktree"}${colors.reset}`);
      return;
    }

    // 3. Log banner to stderr (visible in Claude UI)
    log(formatBanner(worktree, memory));

    // 4. Build and output context to stdout (injected into conversation)
    const context = buildContext(worktree, memory);
    console.log(context);

  } catch (error) {
    // Log error but don't break the user's workflow
    log(`${colors.yellow}[worktree-memory] Error: ${error instanceof Error ? error.message : String(error)}${colors.reset}`);
  }
}

main();
