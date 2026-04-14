#!/usr/bin/env bun
/**
 * Build the context string to inject into Claude's prompt.
 */

import type { WorktreeInfo } from "./detect-worktree";
import type { MemoryResult } from "./query-memory";

/**
 * Truncate content if too long to avoid context bloat
 */
function truncateContent(content: string, maxLines: number = 100): string {
  const lines = content.split("\n");

  if (lines.length <= maxLines) {
    return content;
  }

  return lines.slice(0, maxLines).join("\n") + "\n\n... (truncated)";
}

/**
 * Extract frontmatter and first sections from markdown
 */
function extractEssentials(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let inFrontmatter = false;
  let frontmatterDone = false;
  let sectionCount = 0;
  const maxSections = 4; // Limit to first 4 sections

  for (const line of lines) {
    // Handle frontmatter
    if (line === "---") {
      if (!frontmatterDone) {
        inFrontmatter = !inFrontmatter;
        if (!inFrontmatter) {
          frontmatterDone = true;
        }
        result.push(line);
        continue;
      }
    }

    if (inFrontmatter) {
      result.push(line);
      continue;
    }

    // Count sections
    if (line.startsWith("## ")) {
      sectionCount++;
      if (sectionCount > maxSections) {
        result.push("\n... (more sections omitted)");
        break;
      }
    }

    result.push(line);
  }

  return result.join("\n");
}

/**
 * Build the full context string
 */
export function buildContext(worktree: WorktreeInfo, memory: MemoryResult): string {
  const parts: string[] = [];

  parts.push("<worktree-memory>");
  parts.push("");

  // Instruction for Claude to acknowledge the context
  parts.push("<display-to-user>");
  parts.push(`Memory Wiki context loaded for branch \`${worktree.branch}\``);
  if (worktree.requirementId) {
    parts.push(`Requirement: **${worktree.requirementId}**`);
  }
  parts.push("</display-to-user>");
  parts.push("");

  // Worktree info
  parts.push("## Current Worktree");
  parts.push(`- Path: ${worktree.cwd}`);
  if (worktree.project) {
    parts.push(`- Project: ${worktree.project}`);
  }
  if (worktree.branch) {
    parts.push(`- Branch: ${worktree.branch}`);
  }
  if (worktree.requirementId) {
    parts.push(`- Requirement: ${worktree.requirementId}`);
  }
  parts.push("");

  // Requirement content
  if (memory.requirement) {
    parts.push(`## Requirement: ${memory.requirement.id}`);
    parts.push("");
    parts.push(extractEssentials(memory.requirement.content));
    parts.push("");
  }

  // Project content
  if (memory.project) {
    parts.push(`## Project Context: ${memory.project.name}`);
    parts.push("");
    parts.push(extractEssentials(memory.project.content));
    parts.push("");
  }

  // Concepts (brief)
  if (memory.concepts.length > 0) {
    parts.push("## Related Concepts");
    parts.push("");
    for (const concept of memory.concepts) {
      parts.push(`### ${concept.name}`);
      parts.push(truncateContent(concept.content, 30));
      parts.push("");
    }
  }

  parts.push("</worktree-memory>");

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
    console.log(context);
  } else {
    console.log("Not in a worktree-manager workspace");
  }
}
