import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import type { StagingFile } from "../types";

/** Read a file, return empty string if not found */
function readFile(path: string): string {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

/** Read the memory wiki state needed for finalize */
export function readMemoryState(memoryDir: string, requirementId: string | null, projectName: string | null) {
  return {
    schema: readFile(join(memoryDir, "schema.md")),
    index: readFile(join(memoryDir, "index.md")),
    requirement: requirementId
      ? readFile(join(memoryDir, "requirements", `${requirementId}.md`))
      : "",
    project: projectName
      ? readFile(join(memoryDir, "projects", `${projectName}.md`))
      : "",
  };
}

/** Read all organized summaries from a staging directory */
export function readOrganizedSummaries(stagingDir: string): Array<{ filename: string; content: string }> {
  const organizedDir = join(stagingDir, "organized");
  if (!existsSync(organizedDir)) return [];

  return readdirSync(organizedDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => ({
      filename: f,
      content: readFileSync(join(organizedDir, f), "utf-8"),
    }));
}

/** Read and validate a staging JSON file */
export function readStagingFile(path: string): StagingFile {
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  if (!raw.version || !raw.worktree || !Array.isArray(raw.conversation)) {
    throw new Error(`Invalid staging file format: ${path}`);
  }
  return raw as StagingFile;
}

/** Find all unprocessed staging files (no matching organized/ output) */
export function findAllUnprocessedStaging(stagingDir: string): string[] {
  if (!existsSync(stagingDir)) return [];

  const organizedDir = join(stagingDir, "organized");
  const processed = new Set(
    existsSync(organizedDir)
      ? readdirSync(organizedDir).map((f) => f.replace(/\.md$/, ""))
      : []
  );

  return readdirSync(stagingDir)
    .filter((f) => f.endsWith(".json"))
    .filter((f) => !processed.has(f.replace(/\.json$/, "")))
    .sort()
    .map((f) => join(stagingDir, f));
}

/** Find the newest unprocessed staging file (no matching organized/ output) */
export function findUnprocessedStaging(stagingDir: string): string | null {
  if (!existsSync(stagingDir)) return null;

  const organizedDir = join(stagingDir, "organized");
  const processed = new Set(
    existsSync(organizedDir)
      ? readdirSync(organizedDir).map((f) => f.replace(/\.md$/, ""))
      : []
  );

  const staging = readdirSync(stagingDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse();

  for (const f of staging) {
    const base = f.replace(/\.json$/, "");
    if (!processed.has(base)) {
      return join(stagingDir, f);
    }
  }

  return null;
}
