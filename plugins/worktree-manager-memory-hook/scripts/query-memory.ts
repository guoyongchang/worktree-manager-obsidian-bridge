#!/usr/bin/env bun
/**
 * Query the Memory Wiki for relevant context.
 */

import * as path from "path";
import * as fs from "fs";
import type { WorktreeInfo } from "./detect-worktree";

export interface MemoryEntry {
  name: string;
  path: string;
  content: string;
}

export interface StagingEntry {
  filename: string;
  messageCount: number;
  branch?: string;
  project?: string;
  requirementId?: string;
  isOrganized: boolean;
}

export interface MemoryResult {
  requirement?: {
    id: string;
    content: string;
  };
  project?: {
    name: string;
    content: string;
  };
  concepts: MemoryEntry[];
  staging: {
    pending: StagingEntry[];
    organized: StagingEntry[];
  };
}

/**
 * Find the memory wiki root.
 */
function findMemoryRoot(worktree: WorktreeInfo): string | undefined {
  if (worktree.vaultPath) {
    const memoryPath = path.join(worktree.vaultPath, "memory");
    if (fs.existsSync(memoryPath)) {
      return memoryPath;
    }
  }
  return undefined;
}

/**
 * Read a markdown file safely.
 */
function readMarkdown(filePath: string): string | undefined {
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
 * Find requirement file by ID.
 */
function findRequirement(memoryRoot: string, requirementId: string): { id: string; content: string } | undefined {
  const reqDir = path.join(memoryRoot, "requirements");

  if (!fs.existsSync(reqDir)) {
    return undefined;
  }

  // Try exact match first
  const exactPath = path.join(reqDir, `${requirementId}.md`);
  let content = readMarkdown(exactPath);

  if (content) {
    return { id: requirementId, content };
  }

  // Try lowercase
  const lowerPath = path.join(reqDir, `${requirementId.toLowerCase()}.md`);
  content = readMarkdown(lowerPath);

  if (content) {
    return { id: requirementId, content };
  }

  // Search for partial match
  try {
    const files = fs.readdirSync(reqDir);
    for (const file of files) {
      if (file.toLowerCase().includes(requirementId.toLowerCase())) {
        content = readMarkdown(path.join(reqDir, file));
        if (content) {
          return { id: file.replace(".md", ""), content };
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return undefined;
}

/**
 * Find project file by name.
 */
function findProject(memoryRoot: string, projectName: string): { name: string; content: string } | undefined {
  const projDir = path.join(memoryRoot, "projects");

  if (!fs.existsSync(projDir)) {
    return undefined;
  }

  // Try exact match
  const exactPath = path.join(projDir, `${projectName}.md`);
  let content = readMarkdown(exactPath);

  if (content) {
    return { name: projectName, content };
  }

  // Try with common variations
  const variations = [
    `${projectName}.md`,
    `${projectName.toLowerCase()}.md`,
    `${projectName.replace(/-/g, "_")}.md`,
  ];

  for (const variant of variations) {
    content = readMarkdown(path.join(projDir, variant));
    if (content) {
      return { name: projectName, content };
    }
  }

  return undefined;
}

/**
 * Query .memory-staging/ for pending sessions and organized summaries.
 */
function queryStaging(worktree: WorktreeInfo): MemoryResult["staging"] {
  const pending: StagingEntry[] = [];
  const organized: StagingEntry[] = [];

  const stagingDir = path.join(worktree.cwd, ".memory-staging");
  if (!fs.existsSync(stagingDir)) {
    return { pending, organized };
  }

  // Pending sessions: *.json files directly in stagingDir
  try {
    const files = fs.readdirSync(stagingDir).filter(f => f.endsWith(".json"));
    for (const file of files) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(stagingDir, file), "utf-8"));
        pending.push({
          filename: file,
          messageCount: content.message_count || content.conversation?.length || 0,
          branch: content.worktree?.branch,
          project: content.worktree?.project,
          requirementId: content.worktree?.requirement_id,
          isOrganized: false,
        });
      } catch {
        // skip malformed
      }
    }
  } catch {
    // ignore
  }

  // Organized summaries: organized/*.md
  const organizedDir = path.join(stagingDir, "organized");
  if (fs.existsSync(organizedDir)) {
    try {
      const files = fs.readdirSync(organizedDir).filter(f => f.endsWith(".md"));
      for (const file of files) {
        // Try to find matching JSON for metadata
        const jsonName = file.replace(".md", ".json");
        let meta: any = {};
        try {
          meta = JSON.parse(fs.readFileSync(path.join(stagingDir, jsonName), "utf-8"));
        } catch {
          // no matching json
        }
        organized.push({
          filename: file,
          messageCount: meta.message_count || meta.conversation?.length || 0,
          branch: meta.worktree?.branch,
          project: meta.worktree?.project,
          requirementId: meta.worktree?.requirement_id,
          isOrganized: true,
        });
      }
    } catch {
      // ignore
    }
  }

  return { pending, organized };
}

/**
 * Query the Memory Wiki for context relevant to this worktree.
 */
export async function queryMemory(worktree: WorktreeInfo): Promise<MemoryResult> {
  const result: MemoryResult = {
    concepts: [],
    staging: { pending: [], organized: [] },
  };

  const memoryRoot = findMemoryRoot(worktree);

  if (!memoryRoot) {
    // Still query staging even if no vault memory
    result.staging = queryStaging(worktree);
    return result;
  }

  // Find requirement
  if (worktree.requirementId) {
    result.requirement = findRequirement(memoryRoot, worktree.requirementId);
  }

  // Find project
  if (worktree.project) {
    result.project = findProject(memoryRoot, worktree.project);
  }

  // Query staging
  result.staging = queryStaging(worktree);

  return result;
}

// CLI entry point for testing
if (import.meta.main) {
  const { detectWorktree } = await import("./detect-worktree");
  const worktree = await detectWorktree(process.cwd());

  if (worktree) {
    const memory = await queryMemory(worktree);
    console.log(JSON.stringify(memory, null, 2));
  } else {
    console.log("Not in a worktree-manager workspace");
  }
}
