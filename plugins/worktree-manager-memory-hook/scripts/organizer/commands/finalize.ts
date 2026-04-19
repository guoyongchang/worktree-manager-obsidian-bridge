import { readFileSync, readdirSync, existsSync, rmSync } from "fs";
import { join } from "path";
import type { MemoryOperation, OrganizerConfig, StagingFile } from "../types";
import { readMemoryState, readOrganizedSummaries } from "../memory/reader";
import { applyOperations } from "../memory/writer";
import { createLlmClient } from "../llm/client";

/**
 * Load the finalize prompt template.
 * Tries import.meta.dir-relative path first, then cwd-relative.
 */
function loadPromptTemplate(): string {
  const paths = [
    join(import.meta.dir, "../prompts/finalize.md"),
    join(process.cwd(), "prompts/finalize.md"),
  ];

  for (const p of paths) {
    if (existsSync(p)) {
      return readFileSync(p, "utf-8");
    }
  }

  throw new Error(
    `finalize.md prompt template not found. Tried:\n${paths.join("\n")}`
  );
}

/**
 * Build the system + user prompt for the finalize LLM call.
 */
export function buildFinalizePrompt(
  memoryState: {
    schema: string;
    index: string;
    requirement: string;
    project: string;
  },
  summaries: Array<{ filename: string; content: string }>,
  requirementId: string | null,
  projectName: string | null
): { system: string; user: string } {
  const template = loadPromptTemplate();

  const summariesText = summaries
    .map((s) => `#### Session: ${s.filename}\n\n${s.content}`)
    .join("\n\n---\n\n");

  const user = template
    .replace("{{schema_md}}", memoryState.schema)
    .replace("{{index_md}}", memoryState.index)
    .replace("{{requirement_content}}", memoryState.requirement || "(none)")
    .replace("{{project_content}}", memoryState.project || "(none)")
    .replace("{{summaries}}", summariesText);

  return {
    system: "You are a Memory Wiki maintainer. Respond only with the JSON array of operations.",
    user,
  };
}

/**
 * Parse the LLM output into MemoryOperation[].
 * Tries code fence first, then raw JSON array.
 */
export function parseFinalizeResult(llmOutput: string): MemoryOperation[] {
  // Try code fence: ```json ... ```
  const fenceMatch = llmOutput.match(/```json\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      const parsed = JSON.parse(fenceMatch[1].trim());
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
    }
  }

  // Try raw JSON array
  const bracketStart = llmOutput.indexOf("[");
  const bracketEnd = llmOutput.lastIndexOf("]");
  if (bracketStart !== -1 && bracketEnd > bracketStart) {
    try {
      const parsed = JSON.parse(
        llmOutput.slice(bracketStart, bracketEnd + 1)
      );
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
    }
  }

  return [];
}

/**
 * Infer requirementId and projectName from staging JSON files.
 */
function inferContext(
  stagingDir: string
): { requirementId: string | null; projectName: string | null } {
  const jsonFiles = readdirSync(stagingDir).filter((f) => f.endsWith(".json"));

  for (const f of jsonFiles) {
    try {
      const data = JSON.parse(
        readFileSync(join(stagingDir, f), "utf-8")
      ) as StagingFile;
      if (data.worktree) {
        return {
          requirementId: data.worktree.requirement_id ?? null,
          projectName: data.worktree.project ?? null,
        };
      }
    } catch {
      // skip malformed files
    }
  }

  return { requirementId: null, projectName: null };
}

/**
 * Run the full finalize pipeline:
 * 1. Read organized summaries
 * 2. Infer context from staging files
 * 3. Read memory state
 * 4. Build prompt + call LLM
 * 5. Parse operations + apply
 * 6. Clean up staging on success
 */
export async function runFinalize(
  stagingDir: string,
  memoryDir: string,
  config: OrganizerConfig
): Promise<void> {
  if (!existsSync(stagingDir)) {
    console.log("No .memory-staging directory found — nothing to finalize.");
    return;
  }

  const summaries = readOrganizedSummaries(stagingDir);
  if (summaries.length === 0) {
    console.log("No organized summaries found — nothing to finalize.");
    return;
  }

  const { requirementId, projectName } = inferContext(stagingDir);
  const memoryState = readMemoryState(memoryDir, requirementId, projectName);

  const { system, user } = buildFinalizePrompt(
    memoryState,
    summaries,
    requirementId,
    projectName
  );

  const client = createLlmClient(config.llm.finalize);
  const llmOutput = await client.chat(system, user);
  const operations = parseFinalizeResult(llmOutput);

  if (operations.length === 0) {
    console.log("LLM returned no operations — nothing to apply.");
    return;
  }

  const result = await applyOperations(memoryDir, operations);
  console.log(
    `Finalize complete: ${result.applied} applied, ${result.skipped} skipped.`
  );
  if (result.errors.length > 0) {
    console.warn("Errors:", result.errors);
  }

  // Clean up staging only on full success (no errors)
  if (result.errors.length === 0) {
    const organizedDir = join(stagingDir, "organized");
    if (existsSync(organizedDir)) {
      rmSync(organizedDir, { recursive: true });
    }

    for (const f of readdirSync(stagingDir).filter((f) => f.endsWith(".json"))) {
      rmSync(join(stagingDir, f));
    }
    console.log("Staging cleaned up.");
  } else {
    console.warn("Staging preserved due to errors — retry with --finalize.");
  }
}
