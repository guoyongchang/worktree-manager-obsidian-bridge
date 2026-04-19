import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { StagingFile, OrganizerConfig } from "../types";
import { findAllUnprocessedStaging, readStagingFile } from "../memory/reader";
import { createLlmClient } from "../llm/client";

/**
 * Load the accumulate prompt template, trying package-relative path first,
 * then falling back to cwd-relative path.
 */
function loadPromptTemplate(): string {
  const paths = [
    join(import.meta.dir, "../prompts/accumulate.md"),
    join(process.cwd(), "prompts/accumulate.md"),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      return readFileSync(p, "utf-8");
    }
  }

  throw new Error(
    `accumulate.md prompt template not found. Searched:\n${paths.join("\n")}`
  );
}

/**
 * Format conversation entries into readable markdown.
 */
function formatConversation(
  conversation: StagingFile["conversation"]
): string {
  return conversation
    .map((msg) => {
      const label = msg.role === "user" ? "**User:**" : "**Assistant:**";
      return `${label}\n${msg.content}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Build the system and user prompts for the accumulate LLM call.
 */
export function buildAccumulatePrompt(staging: StagingFile): {
  system: string;
  user: string;
} {
  const template = loadPromptTemplate();

  const filled = template
    .replace(/\{\{worktree_name\}\}/g, staging.worktree.name)
    .replace(/\{\{branch\}\}/g, staging.worktree.branch)
    .replace(/\{\{project\}\}/g, staging.worktree.project)
    .replace(
      /\{\{requirement_id\}\}/g,
      staging.worktree.requirement_id ?? "none"
    )
    .replace(
      /\{\{conversation\}\}/g,
      formatConversation(staging.conversation)
    );

  // Split: first line is system identity, rest is user message
  const system = "You are a Memory Wiki summarizer.";
  const user = filled;

  return { system, user };
}

/**
 * Parse the LLM output for accumulate mode.
 * The output is already markdown, so just trim whitespace.
 */
export function parseAccumulateResult(llmOutput: string): string {
  return llmOutput.trim();
}

/**
 * Run the accumulate pipeline:
 * 1. Find unprocessed staging files
 * 2. Build prompt from staging data
 * 3. Call LLM
 * 4. Write organized summary to organized/{basename}.md
 */
export async function runAccumulate(
  stagingDir: string,
  config: OrganizerConfig
): Promise<void> {
  const unprocessed = findAllUnprocessedStaging(stagingDir);
  if (unprocessed.length === 0) {
    console.log("[organizer] No unprocessed staging files found");
    return;
  }

  const client = createLlmClient(config.llm.accumulate);

  for (const stagingPath of unprocessed) {
    const staging = readStagingFile(stagingPath) as StagingFile;
    if (!staging.conversation?.length) {
      console.log(`[organizer] Skipping ${stagingPath} — no conversation`);
      continue;
    }

    const { system, user } = buildAccumulatePrompt(staging);
    const response = await client.chat(system, user);
    const summary = parseAccumulateResult(response);

    const organizedDir = join(stagingDir, "organized");
    mkdirSync(organizedDir, { recursive: true });
    const baseName = stagingPath.split("/").pop()!.replace(/\.json$/, "");
    const outputPath = join(organizedDir, `${baseName}.md`);
    writeFileSync(outputPath, summary, "utf-8");

    console.log(`[organizer] Summary written: ${baseName}.md`);
  }
}
