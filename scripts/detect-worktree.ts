#!/usr/bin/env bun
/**
 * Detect if current directory is within a worktree-manager workspace,
 * and extract worktree information.
 */

import { existsSync } from "fs";
import { join, dirname, basename } from "path";

export interface WorktreeInfo {
  /** Full path to current directory */
  cwd: string;
  /** Path to workspace root (contains .worktree-manager.json) */
  workspaceRoot: string;
  /** Path to Memory Wiki */
  memoryPath: string;
  /** Project name (extracted from worktree path) */
  project: string | null;
  /** Branch name */
  branch: string | null;
  /** Extracted requirement ID (e.g., "ERP-27118" from "feature-27118") */
  requirementId: string | null;
}

/**
 * Walk up the directory tree to find workspace root
 */
function findWorkspaceRoot(startPath: string): string | null {
  let current = startPath;

  while (current !== "/") {
    // Check for .worktree-manager.json (workspace root indicator)
    if (existsSync(join(current, ".worktree-manager.json"))) {
      return current;
    }
    current = dirname(current);
  }

  return null;
}

/**
 * Find Memory Wiki path
 */
function findMemoryPath(workspaceRoot: string): string | null {
  // Check .vault/memory/ first (symlink to Vault)
  const vaultMemory = join(workspaceRoot, ".vault", "memory");
  if (existsSync(vaultMemory)) {
    return vaultMemory;
  }

  // Check direct memory/ folder
  const directMemory = join(workspaceRoot, "memory");
  if (existsSync(directMemory)) {
    return directMemory;
  }

  return null;
}

/**
 * Extract worktree info from path
 * Structure: {workspace}/worktrees/{branch-name}
 * The branch-name folder IS the branch, not a project
 */
function parseWorktreePath(cwd: string, workspaceRoot: string): { project: string | null; branch: string | null } {
  const worktreesDir = join(workspaceRoot, "worktrees");

  if (!cwd.startsWith(worktreesDir)) {
    return { project: null, branch: null };
  }

  // Get relative path from worktrees/
  const relativePath = cwd.slice(worktreesDir.length + 1);
  const parts = relativePath.split("/").filter(Boolean);

  if (parts.length >= 1) {
    // The first part is the branch name (worktree folder name)
    // Project is null for now - could be determined from git config later
    return {
      project: null,
      branch: parts[0]
    };
  }

  return { project: null, branch: null };
}

/**
 * Extract requirement ID from branch name
 * Patterns:
 *   feature-27118 → ERP-27118
 *   fix-27118 → ERP-27118
 *   ERP-27118-xxx → ERP-27118
 */
function extractRequirementId(branch: string | null): string | null {
  if (!branch) return null;

  // Pattern 1: ERP-XXXXX at the start
  const erpMatch = branch.match(/^(ERP-\d+)/i);
  if (erpMatch) {
    return erpMatch[1].toUpperCase();
  }

  // Pattern 2: feature-XXXXX, fix-XXXXX, etc.
  const numMatch = branch.match(/(?:feature|fix|bugfix|hotfix|task)[-_](\d+)/i);
  if (numMatch) {
    return `ERP-${numMatch[1]}`;
  }

  // Pattern 3: Just a number
  const pureNumMatch = branch.match(/(\d{5,})/);
  if (pureNumMatch) {
    return `ERP-${pureNumMatch[1]}`;
  }

  return null;
}

/**
 * Main detection function
 */
export async function detectWorktree(cwd: string): Promise<WorktreeInfo | null> {
  const workspaceRoot = findWorkspaceRoot(cwd);

  if (!workspaceRoot) {
    return null;
  }

  const memoryPath = findMemoryPath(workspaceRoot);

  if (!memoryPath) {
    return null;
  }

  const { project, branch } = parseWorktreePath(cwd, workspaceRoot);
  const requirementId = extractRequirementId(branch);

  return {
    cwd,
    workspaceRoot,
    memoryPath,
    project,
    branch,
    requirementId
  };
}

// CLI entry point for testing
if (import.meta.main) {
  const result = await detectWorktree(process.cwd());
  console.log(JSON.stringify(result, null, 2));
}
