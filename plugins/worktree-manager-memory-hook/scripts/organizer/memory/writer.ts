import { resolve, relative, dirname } from "node:path";
import { mkdir, readFile, writeFile, appendFile, access } from "node:fs/promises";
import type { MemoryOperation } from "../types";

/** Allowed path prefixes inside the memory directory. */
const ALLOWED_PREFIXES = ["requirements/", "projects/", "index.md", "log.md"];

export interface ApplyResult {
  applied: number;
  skipped: number;
  errors: string[];
}

/**
 * Validate that a relative path is safe:
 * - No ".." segments
 * - Resolves to a location inside memoryDir
 * - Starts with one of the allowed prefixes
 */
function validatePath(
  memoryDir: string,
  relPath: string
): { ok: true; abs: string } | { ok: false; reason: string } {
  // Reject ".." anywhere in the path
  if (relPath.includes("..")) {
    return { ok: false, reason: `path traversal rejected: ${relPath}` };
  }

  const abs = resolve(memoryDir, relPath);
  const rel = relative(memoryDir, abs);

  // Must stay inside memoryDir (relative must not start with "..")
  if (rel.startsWith("..") || resolve(abs) !== abs) {
    return { ok: false, reason: `path escapes memory directory: ${relPath}` };
  }

  // Must match one of the allowed prefixes
  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => rel === prefix.replace(/\/$/, "") || rel.startsWith(prefix)
  );
  if (!allowed) {
    return {
      ok: false,
      reason: `path not in allowed directories: ${relPath}`,
    };
  }

  return { ok: true, abs };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Replace a section identified by a heading path like "各项目改动/ProjectA".
 *
 * The heading path is split by "/". The first segment matches an h2 (`## ...`),
 * the second matches an h3 (`### ...`) under it, and so on.
 * Once the target heading is found, all content until the next heading of the
 * same or higher level is replaced with `newContent`.
 */
function replaceSection(
  fileContent: string,
  sectionPath: string,
  newContent: string
): string {
  const segments = sectionPath.split("/");
  const lines = fileContent.split("\n");

  // Find the line range for the deepest heading in the path.
  // Each segment corresponds to a heading level starting at 2.
  let searchStart = 0;
  let targetStart = -1;
  let targetLevel = 0;

  for (let depth = 0; depth < segments.length; depth++) {
    const headingLevel = depth + 2; // ## = 2, ### = 3, ...
    const prefix = "#".repeat(headingLevel) + " ";
    const needle = segments[depth].trim();
    let found = false;

    for (let i = searchStart; i < lines.length; i++) {
      const trimmed = lines[i].trimEnd();
      if (trimmed.startsWith(prefix) && trimmed.slice(prefix.length).trim() === needle) {
        targetStart = i;
        targetLevel = headingLevel;
        searchStart = i + 1; // next segment searches after this line
        found = true;
        break;
      }
    }

    if (!found) {
      // Section path not found — return content unchanged
      return fileContent;
    }
  }

  // Now find where this section ends: next heading at same or higher level
  let targetEnd = lines.length; // default: rest of file
  for (let i = targetStart + 1; i < lines.length; i++) {
    const match = lines[i].match(/^(#{1,6})\s/);
    if (match && match[1].length <= targetLevel) {
      targetEnd = i;
      break;
    }
  }

  // Rebuild: keep heading line, replace body, keep rest
  const before = lines.slice(0, targetStart + 1);
  const after = lines.slice(targetEnd);

  // Ensure newContent has proper spacing
  const body = newContent.endsWith("\n") ? newContent : newContent + "\n";

  return [...before, body, ...after].join("\n");
}

/**
 * Apply a list of MemoryOperations to the given memory directory.
 */
export async function applyOperations(
  memoryDir: string,
  operations: MemoryOperation[]
): Promise<ApplyResult> {
  const result: ApplyResult = { applied: 0, skipped: 0, errors: [] };
  const absMemoryDir = resolve(memoryDir);

  for (const op of operations) {
    const check = validatePath(absMemoryDir, op.path);
    if (!check.ok) {
      result.skipped++;
      result.errors.push(check.reason);
      continue;
    }
    const absPath = check.abs;

    try {
      switch (op.op) {
        case "create": {
          if (await fileExists(absPath)) {
            result.skipped++;
            result.errors.push(
              `file already exists, refusing to overwrite: ${op.path}`
            );
            continue;
          }
          await mkdir(dirname(absPath), { recursive: true });
          await writeFile(absPath, op.content, "utf-8");
          result.applied++;
          break;
        }

        case "update": {
          if (op.section) {
            const current = await readFile(absPath, "utf-8");
            const updated = replaceSection(current, op.section, op.content);
            if (updated === current) {
              result.errors.push(`Section not found: ${op.section} in ${op.path}`);
            }
            await writeFile(absPath, updated, "utf-8");
          } else {
            await writeFile(absPath, op.content, "utf-8");
          }
          result.applied++;
          break;
        }

        case "append_log": {
          await appendFile(absPath, op.content, "utf-8");
          result.applied++;
          break;
        }

        default: {
          result.skipped++;
          result.errors.push(`unknown op: ${(op as any).op}`);
        }
      }
    } catch (err: any) {
      result.skipped++;
      result.errors.push(`${op.op} ${op.path}: ${err.message}`);
    }
  }

  return result;
}
