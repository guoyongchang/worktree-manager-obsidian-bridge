#!/usr/bin/env bun
/**
 * Query Memory Wiki for relevant content based on worktree info.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { WorktreeInfo } from "./detect-worktree";

export interface MemoryResult {
  /** Requirement page content */
  requirement: {
    id: string;
    path: string;
    content: string;
  } | null;
  /** Project page content */
  project: {
    name: string;
    path: string;
    content: string;
  } | null;
  /** Additional concept pages */
  concepts: Array<{
    name: string;
    path: string;
    content: string;
  }>;
}

/**
 * Read a markdown file, return null if not found
 */
function readMarkdownFile(path: string): string | null {
  try {
    if (!existsSync(path)) {
      return null;
    }
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Parse index.md to find requirement by ID
 */
function findRequirementInIndex(indexContent: string, requirementId: string): string | null {
  // Look for [[ERP-XXXXX]] pattern in index
  const pattern = new RegExp(`\\[\\[${requirementId}\\]\\]`, "i");
  if (pattern.test(indexContent)) {
    return requirementId;
  }

  // Also check for requirement ID in table rows
  const tablePattern = new RegExp(`\\|.*${requirementId}.*\\|`, "i");
  if (tablePattern.test(indexContent)) {
    return requirementId;
  }

  return null;
}

/**
 * Find requirements that mention a specific project
 */
function findRequirementsByProject(indexContent: string, projectName: string): string[] {
  const requirements: string[] = [];

  // Match table rows that contain the project name
  // Format: | [[ERP-27118]] | title | project1, project2 | status |
  const lines = indexContent.split("\n");

  for (const line of lines) {
    if (line.includes(projectName) && line.includes("[[ERP-")) {
      const match = line.match(/\[\[(ERP-\d+)\]\]/i);
      if (match) {
        requirements.push(match[1].toUpperCase());
      }
    }
  }

  return requirements;
}

/**
 * Extract wikilinks from content [[concept-name]]
 */
function extractConceptLinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g);
  const concepts: string[] = [];

  for (const match of matches) {
    const link = match[1];
    // Filter out non-concept links (requirements, projects)
    if (!link.startsWith("ERP-") && !link.includes("/")) {
      concepts.push(link);
    }
  }

  return concepts;
}

/**
 * Main query function
 */
export async function queryMemory(worktree: WorktreeInfo): Promise<MemoryResult> {
  const result: MemoryResult = {
    requirement: null,
    project: null,
    concepts: []
  };

  const memoryPath = worktree.memoryPath;

  // 1. Read index.md
  const indexPath = join(memoryPath, "index.md");
  const indexContent = readMarkdownFile(indexPath);

  if (!indexContent) {
    return result;
  }

  // 2. Find requirement
  let requirementId = worktree.requirementId;

  if (requirementId) {
    // Verify it exists in index
    const found = findRequirementInIndex(indexContent, requirementId);
    if (!found && worktree.project) {
      // Fallback: find requirements by project
      const projectReqs = findRequirementsByProject(indexContent, worktree.project);
      if (projectReqs.length > 0) {
        requirementId = projectReqs[0]; // Take the first active one
      }
    }
  } else if (worktree.project) {
    // No requirement ID from branch, try to find by project
    const projectReqs = findRequirementsByProject(indexContent, worktree.project);
    if (projectReqs.length > 0) {
      requirementId = projectReqs[0];
    }
  }

  // 3. Load requirement file
  if (requirementId) {
    const reqPath = join(memoryPath, "requirements", `${requirementId}.md`);
    const reqContent = readMarkdownFile(reqPath);

    if (reqContent) {
      result.requirement = {
        id: requirementId,
        path: reqPath,
        content: reqContent
      };
    }
  }

  // 4. Load project file
  if (worktree.project) {
    const projectPath = join(memoryPath, "projects", `${worktree.project}.md`);
    const projectContent = readMarkdownFile(projectPath);

    if (projectContent) {
      result.project = {
        name: worktree.project,
        path: projectPath,
        content: projectContent
      };
    }
  }

  // 5. Extract and load concepts (optional, limit to avoid context bloat)
  const allContent = [
    result.requirement?.content || "",
    result.project?.content || ""
  ].join("\n");

  const conceptLinks = extractConceptLinks(allContent);
  const loadedConcepts = new Set<string>();

  for (const concept of conceptLinks.slice(0, 3)) { // Limit to 3 concepts
    if (loadedConcepts.has(concept)) continue;

    const conceptPath = join(memoryPath, "concepts", `${concept}.md`);
    const conceptContent = readMarkdownFile(conceptPath);

    if (conceptContent) {
      result.concepts.push({
        name: concept,
        path: conceptPath,
        content: conceptContent
      });
      loadedConcepts.add(concept);
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
    console.log(JSON.stringify({
      requirement: memory.requirement ? { id: memory.requirement.id, path: memory.requirement.path } : null,
      project: memory.project ? { name: memory.project.name, path: memory.project.path } : null,
      concepts: memory.concepts.map(c => ({ name: c.name, path: c.path }))
    }, null, 2));
  } else {
    console.log("Not in a worktree-manager workspace");
  }
}
