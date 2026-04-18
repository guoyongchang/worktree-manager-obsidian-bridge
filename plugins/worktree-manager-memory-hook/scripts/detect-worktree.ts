#!/usr/bin/env bun
/**
 * Detect if we're in a worktree-manager workspace and extract metadata.
 */

import * as path from "path";
import * as fs from "fs";

export interface WorktreeInfo {
  cwd: string;
  project?: string;
  branch?: string;
  requirementId?: string;
  vaultPath?: string;
}

/**
 * Extract requirement ID from branch name.
 * Examples:
 *   feature-27118 -> ERP-27118
 *   fix-12345 -> ERP-12345
 *   bugfix/ABC-999 -> ABC-999
 */
function extractRequirementId(branch: string): string | undefined {
  // Try common patterns
  const patterns = [
    /^feature-(\d+)$/i, // feature-27118 -> ERP-27118
    /^fix-(\d+)$/i, // fix-12345 -> ERP-12345
    /^bugfix\/([A-Z]+-\d+)$/i, // bugfix/ABC-999 -> ABC-999
    /^feature\/([A-Z]+-\d+)$/i, // feature/ABC-999 -> ABC-999
    /([A-Z]+-\d+)/i, // Any JIRA-like pattern
  ];

  for (const pattern of patterns) {
    const match = branch.match(pattern);
    if (match) {
      const id = match[1];
      // If it's just a number, prefix with ERP-
      if (/^\d+$/.test(id)) {
        return `ERP-${id}`;
      }
      return id.toUpperCase();
    }
  }

  return undefined;
}

/**
 * Find the worktree-manager space root by looking for markers.
 */
function findSpaceRoot(startPath: string): string | undefined {
  let current = startPath;

  while (current !== "/") {
    // Check for worktree-manager markers
    if (
      fs.existsSync(path.join(current, ".worktree-manager")) ||
      fs.existsSync(path.join(current, "worktrees")) ||
      fs.existsSync(path.join(current, ".vault"))
    ) {
      return current;
    }
    current = path.dirname(current);
  }

  return undefined;
}

/**
 * Get the current git branch name.
 */
async function getGitBranch(dir: string): Promise<string | undefined> {
  try {
    const gitHead = path.join(dir, ".git");

    if (fs.existsSync(gitHead)) {
      const content = fs.readFileSync(gitHead, "utf-8").trim();

      // Check if it's a gitdir reference (worktree)
      if (content.startsWith("gitdir:")) {
        const gitDir = content.replace("gitdir:", "").trim();
        const headFile = path.join(gitDir, "HEAD");

        if (fs.existsSync(headFile)) {
          const headContent = fs.readFileSync(headFile, "utf-8").trim();
          if (headContent.startsWith("ref: refs/heads/")) {
            return headContent.replace("ref: refs/heads/", "");
          }
        }
      } else if (fs.statSync(gitHead).isDirectory()) {
        // Regular .git directory
        const headFile = path.join(gitHead, "HEAD");
        if (fs.existsSync(headFile)) {
          const headContent = fs.readFileSync(headFile, "utf-8").trim();
          if (headContent.startsWith("ref: refs/heads/")) {
            return headContent.replace("ref: refs/heads/", "");
          }
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return undefined;
}

/**
 * Detect worktree information from the current directory.
 */
export async function detectWorktree(cwd: string): Promise<WorktreeInfo | undefined> {
  const spaceRoot = findSpaceRoot(cwd);

  if (!spaceRoot) {
    return undefined;
  }

  let branch = await getGitBranch(cwd);

  // Fallback: infer branch from worktree directory name when no .git at cwd
  if (!branch) {
    const relativePath = path.relative(spaceRoot, cwd);
    const parts = relativePath.split(path.sep);
    if (parts[0] === "worktrees" && parts[1]) {
      branch = parts[1];
    } else if (parts[0]) {
      // cwd is directly under space root (e.g. ux-optimize)
      branch = parts[0];
    }
  }

  const requirementId = branch ? extractRequirementId(branch) : undefined;

  // Try to find project name from path
  const relativePath = path.relative(spaceRoot, cwd);
  const parts = relativePath.split(path.sep);
  const project = parts[0] === "worktrees" ? parts[1] : parts[0];

  // Look for .vault in space root
  const vaultPath = path.join(spaceRoot, ".vault");
  const hasVault = fs.existsSync(vaultPath);

  return {
    cwd,
    project: project || undefined,
    branch,
    requirementId,
    vaultPath: hasVault ? vaultPath : undefined,
  };
}

// CLI entry point for testing
if (import.meta.main) {
  const info = await detectWorktree(process.cwd());
  console.log(JSON.stringify(info, null, 2));
}
